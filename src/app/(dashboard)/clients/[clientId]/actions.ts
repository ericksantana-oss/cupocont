"use server";

import path from "path";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireClientAccess } from "@/lib/auth/guards";
import { logActivity } from "@/lib/activity";
import { processDocument } from "@/lib/rag/process";
import type { Keyword } from "@/lib/keywords/provider";
import { buildClientKnowledgeContext, briefingSearchQuery } from "@/lib/ai/contextBuilder";
import { generateThemes } from "@/lib/ai/prompts/generateThemes";
import { generateThemePiece } from "@/lib/ai/prompts/generateText";
import { normalizeSlideRoles, parseSlides, type PieceFormat, type Slide } from "@/lib/contentPiece";
import { getTopMedia, getProfileMetrics } from "@/lib/meta/graph";
import { indexarTemas } from "@/lib/themeSimilarity";
import { publishToInstagram, publishToFacebook, translateMetaError } from "@/lib/meta/publish";
import {
  uploadClientFile,
  deleteClientFile,
  uploadPostMedia,
  deletePostMedia,
  getPostMediaSignedUrl,
} from "@/lib/storage";
import { MEDIA_CONTENT_TYPE, sanitizeForStorageKey, validateFileCountForFormat } from "@/lib/mediaUpload";

function revalidateClient(clientId: string) {
  revalidatePath(`/clients/${clientId}`);
}

// ---------- Contexto (RAG) ----------

function extensionToFileType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase().replace(".", "");
  if (ext === "pdf" || ext === "docx" || ext === "txt") return ext;
  throw new Error(`Formato não suportado: .${ext} (use PDF, DOCX ou TXT)`);
}


const FILE_TYPE_CONTENT_TYPE: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
};

export async function uploadDocumentAction(clientId: string, formData: FormData) {
  const user = await requireClientAccess(clientId);

  const file = formData.get("file") as File | null;
  const sourceUrl = String(formData.get("sourceUrl") ?? "").trim();
  let fileName = "";

  if (file && file.size > 0) {
    const fileType = extensionToFileType(file.name);
    const buffer = Buffer.from(await file.arrayBuffer());

    const storedName = `${randomUUID()}-${sanitizeForStorageKey(file.name)}`;
    const objectPath = `${clientId}/${storedName}`;
    await uploadClientFile(objectPath, buffer, FILE_TYPE_CONTENT_TYPE[fileType]);

    const document = await db.clientDocument.create({
      data: { clientId, fileName: file.name, fileType, originalPath: objectPath, status: "PROCESSING" },
    });

    await processDocument(document.id, { buffer, fileType });
    fileName = file.name;
  } else if (sourceUrl) {
    const document = await db.clientDocument.create({
      data: { clientId, fileName: sourceUrl, fileType: "link", sourceUrl, status: "PROCESSING" },
    });

    await processDocument(document.id, { url: sourceUrl });
    fileName = sourceUrl;
  } else {
    throw new Error("Envie um arquivo ou informe um link de referência.");
  }

  await logActivity({ clientId, userId: user.id, action: "CONTEXT_UPDATED", detail: fileName });
  revalidateClient(clientId);
}

export async function deleteDocumentAction(clientId: string, documentId: string) {
  await requireClientAccess(clientId);
  const document = await db.clientDocument.delete({ where: { id: documentId } });
  if (document.originalPath) await deleteClientFile(document.originalPath).catch(() => null);
  revalidateClient(clientId);
}

// ---------- Palavras-chave ----------
// Sem API de SEO conectada: a etapa é 100% manual, o redator cadastra os termos direto.

export async function addManualKeywordAction(clientId: string, period: string, formData: FormData) {
  const user = await requireClientAccess(clientId);

  const term = String(formData.get("term") ?? "").trim();
  const volume = Number(formData.get("volume") ?? 0) || 0;
  if (!term) throw new Error("Informe o termo.");

  const newKeyword: Keyword = { term, volume, trend: "stable" };

  const latest = await db.keywordReport.findFirst({
    where: { clientId, period },
    orderBy: { createdAt: "desc" },
  });

  if (latest) {
    const keywords = [...(latest.keywords as Keyword[]), newKeyword];
    await db.keywordReport.update({ where: { id: latest.id }, data: { keywords } });
  } else {
    await db.keywordReport.create({
      data: { clientId, period, keywords: [newKeyword], source: "manual" },
    });
  }

  await logActivity({ clientId, userId: user.id, action: "KEYWORDS_RESEARCHED", period, detail: term });
  revalidateClient(clientId);
}

// ---------- Instagram (Meta Graph API) ----------

export async function chooseInstagramAccountAction(clientId: string, formData: FormData) {
  await requireClientAccess(clientId);

  const selectionId = String(formData.get("selectionId"));
  const igUserId = String(formData.get("igUserId"));

  const pending = await db.instagramPendingSelection.findUniqueOrThrow({ where: { id: selectionId } });
  if (pending.clientId !== clientId) throw new Error("Seleção inválida.");

  const candidates = pending.candidates as {
    pageId: string;
    pageName: string;
    igUserId: string;
    igUsername: string | null;
    pageAccessToken: string;
  }[];
  const chosen = candidates.find((c) => c.igUserId === igUserId);
  if (!chosen) throw new Error("Conta não encontrada na seleção.");

  await db.instagramAccount.upsert({
    where: { clientId },
    create: {
      clientId,
      igUserId: chosen.igUserId,
      igUsername: chosen.igUsername,
      pageId: chosen.pageId,
      pageName: chosen.pageName,
      pageAccessToken: chosen.pageAccessToken,
    },
    update: {
      igUserId: chosen.igUserId,
      igUsername: chosen.igUsername,
      pageId: chosen.pageId,
      pageName: chosen.pageName,
      pageAccessToken: chosen.pageAccessToken,
    },
  });
  await db.instagramPendingSelection.delete({ where: { id: selectionId } });

  revalidateClient(clientId);
}

export async function disconnectInstagramAction(clientId: string) {
  await requireClientAccess(clientId);
  await db.instagramAccount.delete({ where: { clientId } }).catch(() => null);
  revalidateClient(clientId);
}

export async function syncInstagramAction(clientId: string) {
  const user = await requireClientAccess(clientId);
  const account = await db.instagramAccount.findUniqueOrThrow({ where: { clientId } });

  const [topMedia, profile] = await Promise.all([
    getTopMedia(account.igUserId, account.pageAccessToken),
    getProfileMetrics(account.igUserId, account.pageAccessToken),
  ]);

  const summaryLines = [
    `Perfil: @${account.igUsername ?? "desconhecido"}`,
    `Seguidores: ${profile.followers_count ?? "não disponível"}`,
    `Total de posts: ${profile.media_count ?? "não disponível"}`,
    "",
    "Posts com melhor engajamento recentemente:",
    ...topMedia.map(
      (media, i) =>
        `${i + 1}. (${media.engagement} interações — ${media.like_count ?? 0} curtidas, ${
          media.comments_count ?? 0
        } comentários) ${media.caption ? media.caption.slice(0, 200) : "(sem legenda)"}`
    ),
  ];

  await db.instagramAccount.update({
    where: { clientId },
    data: { summary: summaryLines.join("\n"), lastSyncedAt: new Date() },
  });

  await logActivity({ clientId, userId: user.id, action: "CONTEXT_UPDATED", detail: "Métricas do Instagram atualizadas" });
  revalidateClient(clientId);
}

// ---------- Briefing ----------

export async function upsertBriefingAction(clientId: string, period: string, formData: FormData) {
  const user = await requireClientAccess(clientId);

  const goals = String(formData.get("goals") ?? "").trim();
  const keyDates = String(formData.get("keyDates") ?? "").trim() || null;
  const suggestedThemes = String(formData.get("suggestedThemes") ?? "").trim() || null;

  if (!goals) throw new Error("O briefing não pode ficar vazio.");

  await db.briefing.upsert({
    where: { clientId_period: { clientId, period } },
    create: { clientId, period, goals, keyDates, suggestedThemes, createdById: user.id },
    update: { goals, keyDates, suggestedThemes },
  });

  await logActivity({ clientId, userId: user.id, action: "BRIEFING_SAVED", period });
  revalidateClient(clientId);
}

// ---------- Temas ----------

export async function generateThemesAction(clientId: string, briefingId: string) {
  const user = await requireClientAccess(clientId);

  const [client, briefing] = await Promise.all([
    db.client.findUniqueOrThrow({ where: { id: clientId } }),
    db.briefing.findUniqueOrThrow({ where: { id: briefingId } }),
  ]);

  const keywordReport = await db.keywordReport.findFirst({
    where: { clientId, period: briefing.period },
    orderBy: { createdAt: "desc" },
  });

  const instagramAccount = await db.instagramAccount.findUnique({ where: { clientId } });
  const ragContext = await buildClientKnowledgeContext(clientId, briefingSearchQuery(briefing));
  const clientKnowledgeContext = instagramAccount?.summary
    ? `${ragContext}\n\n[Desempenho recente no Instagram]\n${instagramAccount.summary}`
    : ragContext;

  // Posts que mais engajaram: evidência real do que funciona com esta audiência.
  // Uma chamada só à API do Meta — olha os últimos 60 posts e devolve os 8 melhores.
  // Falha de rede aqui não pode impedir a geração, então cai para lista vazia.
  const topPerformers = instagramAccount
    ? await getTopMedia(instagramAccount.igUserId, instagramAccount.pageAccessToken, 60, 8).catch(() => [])
    : [];

  const suggested = await generateThemes({
    client,
    briefing,
    clientKnowledgeContext,
    keywords: (keywordReport?.keywords as Keyword[] | undefined) ?? [],
    topPerformers,
  });

  await db.contentTheme.deleteMany({ where: { briefingId, status: "SUGGESTED" } });
  await db.contentTheme.createMany({
    data: suggested.map((theme) => ({
      clientId,
      briefingId,
      title: theme.title,
      justification: theme.justification,
      status: "SUGGESTED",
    })),
  });

  // Indexa os temas para a detecção de repetição. Depois do createMany porque o Prisma
  // não escreve coluna de tipo vector. Falhar aqui só desliga o aviso de repetido —
  // não faz sentido perder 20 temas já gerados por causa disso.
  const criados = await db.contentTheme.findMany({
    where: { briefingId, status: "SUGGESTED" },
    select: { id: true, title: true, justification: true },
  });
  await indexarTemas(criados).catch((err) => {
    console.error("Falha ao indexar temas para detecção de repetição:", err);
  });

  await logActivity({
    clientId,
    userId: user.id,
    action: "THEMES_GENERATED",
    detail: `${suggested.length} temas`,
    period: briefing.period,
  });
  revalidateClient(clientId);
}

export async function updateThemeDecisionAction(
  clientId: string,
  themeId: string,
  status: "SELECTED" | "DISCARDED"
) {
  const user = await requireClientAccess(clientId);
  const theme = await db.contentTheme.findUnique({ where: { id: themeId }, include: { briefing: true } });
  const nextStatus = theme?.status === status ? "SUGGESTED" : status;
  await db.contentTheme.update({ where: { id: themeId }, data: { status: nextStatus } });

  if (theme && nextStatus !== "SUGGESTED") {
    await logActivity({
      clientId,
      userId: user.id,
      action: nextStatus === "SELECTED" ? "THEME_SELECTED" : "THEME_DISCARDED",
      detail: theme.title,
      period: theme.briefing.period,
    });
  }
  revalidateClient(clientId);
}

export async function editThemeAction(clientId: string, themeId: string, formData: FormData) {
  await requireClientAccess(clientId);

  const title = String(formData.get("title") ?? "").trim();
  const justification = String(formData.get("justification") ?? "").trim();
  if (!title) throw new Error("O título do tema não pode ficar vazio.");

  await db.contentTheme.update({ where: { id: themeId }, data: { title, justification } });
  revalidateClient(clientId);
}

// ---------- Textos ----------

export async function generateTextAction(clientId: string, themeId: string, formData: FormData) {
  const user = await requireClientAccess(clientId);

  const theme = await db.contentTheme.findUniqueOrThrow({
    where: { id: themeId },
    include: { client: true, briefing: true },
  });

  const regenerationInstructions = String(formData.get("instructions") ?? "").trim() || undefined;
  const pieceFormat: PieceFormat = formData.get("pieceFormat") === "CARROSSEL" ? "CARROSSEL" : "CARD";

  const lastVersion = await db.generatedText.findFirst({
    where: { themeId },
    orderBy: { version: "desc" },
  });

  const clientKnowledgeContext = await buildClientKnowledgeContext(
    clientId,
    `${theme.title} ${theme.justification}`
  );

  const piece = await generateThemePiece({
    client: theme.client,
    briefing: theme.briefing,
    theme,
    clientKnowledgeContext,
    pieceFormat,
    previousVersion: lastVersion?.content,
    regenerationInstructions,
  });

  await db.generatedText.create({
    data: {
      themeId,
      version: (lastVersion?.version ?? 0) + 1,
      content: piece.caption,
      status: "DRAFT",
      editedById: user.id,
      pieceFormat,
      imageText: piece.imageText,
      slides: piece.slides.length > 0 ? (piece.slides as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
    },
  });

  await logActivity({
    clientId,
    userId: user.id,
    action: "TEXT_GENERATED",
    detail: theme.title,
    period: theme.briefing.period,
  });
  revalidateClient(clientId);
}

export async function editTextAction(clientId: string, textId: string, formData: FormData) {
  const user = await requireClientAccess(clientId);
  const content = String(formData.get("content") ?? "").trim();
  if (!content) throw new Error("A legenda não pode ficar vazia.");

  const existing = await db.generatedText.findUniqueOrThrow({ where: { id: textId } });

  // Campos de arte: só mexe no que corresponde ao formato da peça, pra não gravar
  // slides num card nem texto de imagem num carrossel.
  const imageText =
    existing.pieceFormat === "CARD" ? String(formData.get("imageText") ?? "").trim() || null : existing.imageText;

  let slides: Slide[] = parseSlides(existing.slides);
  if (existing.pieceFormat === "CARROSSEL") {
    const enviados = formData
      .getAll("slideText")
      .map((v) => String(v).trim())
      .filter((t) => t.length > 0);
    slides = normalizeSlideRoles(enviados.map((text) => ({ role: "INTERNO" as const, text })));
  }

  const text = await db.generatedText.update({
    where: { id: textId },
    data: {
      content,
      editedById: user.id,
      imageText,
      slides: slides.length > 0 ? (slides as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
    },
    include: { theme: { include: { briefing: true } } },
  });

  await logActivity({
    clientId,
    userId: user.id,
    action: "TEXT_EDITED",
    detail: text.theme.title,
    period: text.theme.briefing.period,
  });
  revalidateClient(clientId);
}

export async function uploadTextMediaAction(clientId: string, textId: string, formData: FormData) {
  await requireClientAccess(clientId);

  const format = String(formData.get("format") ?? "");
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  validateFileCountForFormat(format, files.length);

  const mediaPaths: string[] = [];
  for (const file of files) {
    const ext = path.extname(file.name).toLowerCase().replace(".", "");
    const buffer = Buffer.from(await file.arrayBuffer());
    const objectPath = `${clientId}/${textId}/${randomUUID()}-${sanitizeForStorageKey(file.name)}`;
    await uploadPostMedia(objectPath, buffer, MEDIA_CONTENT_TYPE[ext]);
    mediaPaths.push(objectPath);
  }

  const existing = await db.generatedText.findUniqueOrThrow({ where: { id: textId } });
  if (existing.mediaPaths) {
    for (const oldPath of existing.mediaPaths as string[]) await deletePostMedia(oldPath).catch(() => null);
  }

  await db.generatedText.update({
    where: { id: textId },
    data: { mediaFormat: format as never, mediaPaths },
  });

  revalidateClient(clientId);
}

export async function removeTextMediaAction(clientId: string, textId: string) {
  await requireClientAccess(clientId);

  const text = await db.generatedText.findUniqueOrThrow({ where: { id: textId } });
  if (text.mediaPaths) {
    for (const oldPath of text.mediaPaths as string[]) await deletePostMedia(oldPath).catch(() => null);
  }

  await db.generatedText.update({
    where: { id: textId },
    data: { mediaFormat: null, mediaPaths: Prisma.DbNull },
  });
  revalidateClient(clientId);
}

export async function approveTextAction(clientId: string, textId: string) {
  const user = await requireClientAccess(clientId);
  const text = await db.generatedText.update({
    where: { id: textId },
    data: { status: "APPROVED" },
    include: { theme: { include: { briefing: true } } },
  });

  await logActivity({
    clientId,
    userId: user.id,
    action: "TEXT_APPROVED",
    detail: text.theme.title,
    period: text.theme.briefing.period,
  });
  revalidateClient(clientId);
}

// ---------- Publicação ----------

export async function publishNowAction(clientId: string, textId: string, formData: FormData) {
  const user = await requireClientAccess(clientId);

  const channels = formData.getAll("channels") as string[];
  const caption = String(formData.get("caption") ?? "").trim();
  if (channels.length === 0) throw new Error("Selecione ao menos um canal.");
  if (!caption) throw new Error("A legenda não pode ficar vazia.");

  const text = await db.generatedText.findUniqueOrThrow({
    where: { id: textId },
    include: { theme: true },
  });
  if (!text.mediaFormat || !text.mediaPaths) throw new Error("Anexe uma mídia antes de publicar.");

  const account = await db.instagramAccount.findUnique({ where: { clientId } });
  if (!account) throw new Error("Conecte o Instagram/Facebook do cliente antes de publicar.");

  const mediaPaths = text.mediaPaths as string[];
  const mediaUrls = await Promise.all(mediaPaths.map((p) => getPostMediaSignedUrl(p, 3600)));
  const format = text.mediaFormat;

  for (const channel of channels) {
    const post = await db.scheduledPost.create({
      data: {
        clientId,
        textId,
        channel: channel === "instagram" ? "INSTAGRAM" : "FACEBOOK",
        format,
        caption,
        mediaPaths,
        scheduledAt: new Date(),
        status: "PUBLISHING",
        createdById: user.id,
      },
    });

    try {
      const result =
        channel === "instagram"
          ? await publishToInstagram({
              igUserId: account.igUserId,
              pageAccessToken: account.pageAccessToken,
              format,
              caption,
              mediaUrls,
            })
          : await publishToFacebook({
              pageId: account.pageId ?? "",
              pageAccessToken: account.pageAccessToken,
              format,
              caption,
              mediaUrls,
            });

      await db.scheduledPost.update({
        where: { id: post.id },
        data: { status: "PUBLISHED", publishedAt: new Date(), permalink: result.permalink },
      });

      await logActivity({
        clientId,
        userId: user.id,
        action: "POST_PUBLISHED",
        detail: `${text.theme.title} (${channel})`,
      });
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : "Erro desconhecido.";
      await db.scheduledPost.update({
        where: { id: post.id },
        data: { status: "ERROR", errorMessage: translateMetaError(rawMessage), errorRaw: rawMessage },
      });
    }
  }

  revalidateClient(clientId);
}
