"use server";

import { randomUUID } from "crypto";
import path from "path";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireClientAccess } from "@/lib/auth/guards";
import { logActivity } from "@/lib/activity";
import { MEDIA_CONTENT_TYPE, sanitizeForStorageKey, validateFileCountForFormat } from "@/lib/mediaUpload";
import { uploadPostMedia, getPostMediaSignedUrl } from "@/lib/storage";
import { publishToInstagram, publishToFacebook, translateMetaError } from "@/lib/meta/publish";
import type { MediaFormat } from "@prisma/client";

export async function createScheduledPostAction(clientId: string, formData: FormData) {
  const user = await requireClientAccess(clientId);

  const channels = formData.getAll("channels") as string[];
  const format = String(formData.get("format") ?? "") as MediaFormat;
  const caption = String(formData.get("caption") ?? "").trim();
  const scheduleMode = String(formData.get("scheduleMode") ?? "now");
  const scheduledDate = String(formData.get("scheduledDate") ?? "");
  const scheduledTime = String(formData.get("scheduledTime") ?? "");

  if (channels.length === 0) throw new Error("Selecione ao menos um canal.");
  if (format !== "STORIES" && !caption) throw new Error("A legenda não pode ficar vazia.");
  if (format === "STORIES" && channels.includes("facebook")) {
    throw new Error('Stories não pode ser publicado no Facebook — desmarque esse canal ou troque o formato.');
  }

  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  validateFileCountForFormat(format, files.length);

  const account = await db.instagramAccount.findUnique({ where: { clientId } });
  if (!account) throw new Error("Conecte o Instagram/Facebook do cliente antes de agendar.");
  if (channels.includes("facebook") && !account.pageId) {
    throw new Error("Facebook não está conectado para este cliente.");
  }

  let scheduledAt = new Date();
  if (scheduleMode === "later") {
    if (!scheduledDate || !scheduledTime) throw new Error("Informe data e horário do agendamento.");
    scheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00`);
    if (scheduledAt.getTime() <= Date.now()) throw new Error("A data/horário do agendamento precisa ser no futuro.");
  }

  const mediaPaths: string[] = [];
  for (const file of files) {
    const ext = path.extname(file.name).toLowerCase().replace(".", "");
    const buffer = Buffer.from(await file.arrayBuffer());
    const objectPath = `${clientId}/standalone/${randomUUID()}-${sanitizeForStorageKey(file.name)}`;
    await uploadPostMedia(objectPath, buffer, MEDIA_CONTENT_TYPE[ext]);
    mediaPaths.push(objectPath);
  }

  const isImmediate = scheduleMode === "now";

  for (const channel of channels) {
    const post = await db.scheduledPost.create({
      data: {
        clientId,
        channel: channel === "instagram" ? "INSTAGRAM" : "FACEBOOK",
        format,
        caption,
        mediaPaths,
        scheduledAt,
        status: isImmediate ? "PUBLISHING" : "SCHEDULED",
        createdById: user.id,
      },
    });

    if (!isImmediate) continue;

    try {
      const mediaUrls = await Promise.all(mediaPaths.map((p) => getPostMediaSignedUrl(p, 3600)));
      const result =
        channel === "instagram"
          ? await publishToInstagram({ igUserId: account.igUserId, pageAccessToken: account.pageAccessToken, format, caption, mediaUrls })
          : await publishToFacebook({ pageId: account.pageId ?? "", pageAccessToken: account.pageAccessToken, format, caption, mediaUrls });

      await db.scheduledPost.update({
        where: { id: post.id },
        data: { status: "PUBLISHED", publishedAt: new Date(), permalink: result.permalink },
      });

      await logActivity({ clientId, userId: user.id, action: "POST_PUBLISHED", detail: `Post avulso (${channel})` });
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : "Erro desconhecido.";
      await db.scheduledPost.update({
        where: { id: post.id },
        data: { status: "ERROR", errorMessage: translateMetaError(rawMessage), errorRaw: rawMessage },
      });
    }
  }

  revalidatePath(`/clients/${clientId}/posts`);
}

export async function cancelScheduledPostAction(clientId: string, postId: string) {
  await requireClientAccess(clientId);
  await db.scheduledPost.deleteMany({ where: { id: postId, clientId, status: "SCHEDULED" } });
  revalidatePath(`/clients/${clientId}/posts`);
}
