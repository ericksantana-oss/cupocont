"use server";

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireClientAccess } from "@/lib/auth/guards";
import { logActivity } from "@/lib/activity";
import { processDocument } from "@/lib/rag/process";
import type { Keyword } from "@/lib/keywords/provider";
import { buildClientKnowledgeContext, briefingSearchQuery } from "@/lib/ai/contextBuilder";
import { generateThemes } from "@/lib/ai/prompts/generateThemes";
import { generateThemeText } from "@/lib/ai/prompts/generateText";
import { getTopMedia, getProfileMetrics } from "@/lib/meta/graph";

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? "./storage/uploads";

function revalidateClient(clientId: string) {
  revalidatePath(`/clients/${clientId}`);
}

// ---------- Contexto (RAG) ----------

function extensionToFileType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase().replace(".", "");
  if (ext === "pdf" || ext === "docx" || ext === "txt") return ext;
  throw new Error(`Formato não suportado: .${ext} (use PDF, DOCX ou TXT)`);
}

export async function uploadDocumentAction(clientId: string, formData: FormData) {
  const user = await requireClientAccess(clientId);

  const file = formData.get("file") as File | null;
  const sourceUrl = String(formData.get("sourceUrl") ?? "").trim();
  let fileName = "";

  if (file && file.size > 0) {
    const fileType = extensionToFileType(file.name);
    const buffer = Buffer.from(await file.arrayBuffer());

    const clientDir = path.join(UPLOADS_DIR, clientId);
    await mkdir(clientDir, { recursive: true });
    const storedName = `${randomUUID()}-${file.name}`;
    const fullPath = path.join(clientDir, storedName);
    await writeFile(fullPath, buffer);

    const document = await db.clientDocument.create({
      data: { clientId, fileName: file.name, fileType, originalPath: fullPath, status: "PROCESSING" },
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
  await db.clientDocument.delete({ where: { id: documentId } });
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
  const campaigns = String(formData.get("campaigns") ?? "").trim() || null;
  const keyDates = String(formData.get("keyDates") ?? "").trim() || null;
  const highlights = String(formData.get("highlights") ?? "").trim() || null;
  const restrictions = String(formData.get("restrictions") ?? "").trim() || null;

  if (!goals) throw new Error("Objetivos do mês são obrigatórios.");

  await db.briefing.upsert({
    where: { clientId_period: { clientId, period } },
    create: { clientId, period, goals, campaigns, keyDates, highlights, restrictions, createdById: user.id },
    update: { goals, campaigns, keyDates, highlights, restrictions },
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

  const suggested = await generateThemes({
    client,
    briefing,
    clientKnowledgeContext,
    keywords: (keywordReport?.keywords as Keyword[] | undefined) ?? [],
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

  const lastVersion = await db.generatedText.findFirst({
    where: { themeId },
    orderBy: { version: "desc" },
  });

  const clientKnowledgeContext = await buildClientKnowledgeContext(
    clientId,
    `${theme.title} ${theme.justification}`
  );

  const content = await generateThemeText({
    client: theme.client,
    briefing: theme.briefing,
    theme,
    clientKnowledgeContext,
    previousVersion: lastVersion?.content,
    regenerationInstructions,
  });

  await db.generatedText.create({
    data: { themeId, version: (lastVersion?.version ?? 0) + 1, content, status: "DRAFT", editedById: user.id },
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
  if (!content) throw new Error("O texto não pode ficar vazio.");

  const text = await db.generatedText.update({
    where: { id: textId },
    data: { content, editedById: user.id },
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
