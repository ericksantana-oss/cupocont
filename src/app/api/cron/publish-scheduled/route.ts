import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { publishToInstagram, publishToFacebook, translateMetaError } from "@/lib/meta/publish";
import { getPostMediaSignedUrl } from "@/lib/storage";

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const due = await db.scheduledPost.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } },
    take: 20,
    include: { client: { include: { instagramAccount: true } } },
  });

  const results: { id: string; outcome: string }[] = [];

  for (const post of due) {
    // Reivindica o post antes de processar, pra evitar publicar duas vezes
    // se essa rota rodar de novo antes de terminar a anterior.
    const claimed = await db.scheduledPost.updateMany({
      where: { id: post.id, status: "SCHEDULED" },
      data: { status: "PUBLISHING" },
    });
    if (claimed.count === 0) continue;

    const account = post.client.instagramAccount;
    if (!account) {
      await db.scheduledPost.update({
        where: { id: post.id },
        data: {
          status: "ERROR",
          errorMessage: "É necessário reconectar a conta do Instagram/Facebook.",
          errorRaw: "Client has no InstagramAccount at publish time",
        },
      });
      results.push({ id: post.id, outcome: "error: no account" });
      continue;
    }

    try {
      const mediaPaths = post.mediaPaths as string[];
      const mediaUrls = await Promise.all(mediaPaths.map((p) => getPostMediaSignedUrl(p, 3600)));

      const result =
        post.channel === "INSTAGRAM"
          ? await publishToInstagram({
              igUserId: account.igUserId,
              pageAccessToken: account.pageAccessToken,
              format: post.format,
              caption: post.caption,
              mediaUrls,
            })
          : await publishToFacebook({
              pageId: account.pageId ?? "",
              pageAccessToken: account.pageAccessToken,
              format: post.format,
              caption: post.caption,
              mediaUrls,
            });

      await db.scheduledPost.update({
        where: { id: post.id },
        data: { status: "PUBLISHED", publishedAt: new Date(), permalink: result.permalink },
      });
      results.push({ id: post.id, outcome: "published" });
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : "Erro desconhecido.";
      await db.scheduledPost.update({
        where: { id: post.id },
        data: { status: "ERROR", errorMessage: translateMetaError(rawMessage), errorRaw: rawMessage },
      });
      results.push({ id: post.id, outcome: `error: ${rawMessage}` });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
