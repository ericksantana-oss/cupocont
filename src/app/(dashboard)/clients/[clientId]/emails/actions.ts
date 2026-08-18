"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireClientAccess } from "@/lib/auth/guards";
import { buildClientKnowledgeContext } from "@/lib/ai/contextBuilder";
import {
  generateFullEmail,
  generateEmailSubjects,
  generateEmailPreheader,
  generateEmailBody,
  generateEmailCta,
  type FlowEmailSummary,
} from "@/lib/ai/prompts/generateEmail";
import type { EmailStatus } from "@prisma/client";

function revalidateEmails(clientId: string) {
  revalidatePath(`/clients/${clientId}/emails`);
}

async function loadFlowHistory(flowId: string | null, excludeEmailId?: string): Promise<FlowEmailSummary[]> {
  if (!flowId) return [];
  const emails = await db.marketingEmail.findMany({
    where: { flowId, id: excludeEmailId ? { not: excludeEmailId } : undefined },
    orderBy: { createdAt: "asc" },
    select: { name: true, subjectA: true, body: true },
  });
  return emails;
}

// ---------- Listagem ----------

export async function listEmails(clientId: string) {
  await requireClientAccess(clientId);
  return db.marketingEmail.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    include: { flow: { select: { name: true } }, createdBy: { select: { name: true } } },
  });
}

export async function listEmailFlows(clientId: string) {
  await requireClientAccess(clientId);
  return db.emailFlow.findMany({ where: { clientId }, orderBy: { name: "asc" } });
}

// ---------- Criação ----------

export async function createPontualEmailAction(clientId: string, formData: FormData) {
  const user = await requireClientAccess(clientId);

  const name = String(formData.get("name") ?? "").trim();
  const briefing = String(formData.get("briefing") ?? "").trim();
  if (!name || !briefing) throw new Error("Nome e contexto/mini-briefing são obrigatórios.");

  const client = await db.client.findUniqueOrThrow({ where: { id: clientId } });
  const clientKnowledgeContext = await buildClientKnowledgeContext(clientId, briefing);

  const generated = await generateFullEmail({ client, clientKnowledgeContext, briefing });

  const email = await db.marketingEmail.create({
    data: { clientId, type: "PONTUAL", name, briefing, createdById: user.id, ...generated },
  });

  revalidateEmails(clientId);
  redirect(`/clients/${clientId}/emails/${email.id}`);
}

export async function createFluxoEmailAction(clientId: string, formData: FormData) {
  const user = await requireClientAccess(clientId);

  const name = String(formData.get("name") ?? "").trim();
  const briefing = String(formData.get("briefing") ?? "").trim();
  const existingFlowId = String(formData.get("flowId") ?? "").trim() || null;
  const newFlowName = String(formData.get("newFlowName") ?? "").trim();
  if (!name || !briefing) throw new Error("Nome e direcionamento são obrigatórios.");

  let flowId = existingFlowId;
  if (!flowId && newFlowName) {
    const flow = await db.emailFlow.create({ data: { clientId, name: newFlowName } });
    flowId = flow.id;
  }

  const client = await db.client.findUniqueOrThrow({ where: { id: clientId } });
  const clientKnowledgeContext = await buildClientKnowledgeContext(clientId, briefing);
  const flowHistory = await loadFlowHistory(flowId);

  const generated = await generateFullEmail({ client, clientKnowledgeContext, briefing, flowHistory });

  const email = await db.marketingEmail.create({
    data: { clientId, flowId, type: "FLUXO", name, briefing, createdById: user.id, ...generated },
  });

  revalidateEmails(clientId);
  redirect(`/clients/${clientId}/emails/${email.id}`);
}

// ---------- Regeneração ----------

async function loadGenerationContext(clientId: string, emailId: string) {
  const [client, email] = await Promise.all([
    db.client.findUniqueOrThrow({ where: { id: clientId } }),
    db.marketingEmail.findUniqueOrThrow({ where: { id: emailId } }),
  ]);

  const clientKnowledgeContext = await buildClientKnowledgeContext(clientId, email.briefing);
  const flowHistory = email.flowId ? await loadFlowHistory(email.flowId, emailId) : undefined;

  return { client, email, clientKnowledgeContext, flowHistory };
}

export async function regenerateFullAction(clientId: string, emailId: string) {
  await requireClientAccess(clientId);
  const { client, email, clientKnowledgeContext, flowHistory } = await loadGenerationContext(clientId, emailId);

  const generated = await generateFullEmail({ client, clientKnowledgeContext, briefing: email.briefing, flowHistory });
  await db.marketingEmail.update({ where: { id: emailId }, data: generated });

  revalidateEmails(clientId);
}

export async function regenerateBodyAction(clientId: string, emailId: string) {
  await requireClientAccess(clientId);
  const { client, email, clientKnowledgeContext, flowHistory } = await loadGenerationContext(clientId, emailId);

  const bodyResult = await generateEmailBody({ client, clientKnowledgeContext, briefing: email.briefing, flowHistory });
  await db.marketingEmail.update({ where: { id: emailId }, data: bodyResult });

  revalidateEmails(clientId);
}

export async function regenerateSubjectsAction(clientId: string, emailId: string) {
  await requireClientAccess(clientId);
  const { client, email, clientKnowledgeContext, flowHistory } = await loadGenerationContext(clientId, emailId);

  const subjects = await generateEmailSubjects({
    client,
    clientKnowledgeContext,
    briefing: email.briefing,
    flowHistory,
    body: email.body ?? "",
  });
  await db.marketingEmail.update({ where: { id: emailId }, data: subjects });

  revalidateEmails(clientId);
}

export async function regeneratePreheaderAction(clientId: string, emailId: string) {
  await requireClientAccess(clientId);
  const { client, email, clientKnowledgeContext, flowHistory } = await loadGenerationContext(clientId, emailId);

  const preheader = await generateEmailPreheader({
    client,
    clientKnowledgeContext,
    briefing: email.briefing,
    flowHistory,
    body: email.body ?? "",
  });
  await db.marketingEmail.update({ where: { id: emailId }, data: { preheader } });

  revalidateEmails(clientId);
}

export async function regenerateCtaAction(clientId: string, emailId: string) {
  await requireClientAccess(clientId);
  const { client, email, clientKnowledgeContext, flowHistory } = await loadGenerationContext(clientId, emailId);

  const ctaText = await generateEmailCta({
    client,
    clientKnowledgeContext,
    briefing: email.briefing,
    flowHistory,
    body: email.body ?? "",
  });
  await db.marketingEmail.update({ where: { id: emailId }, data: { ctaText } });

  revalidateEmails(clientId);
}

// ---------- Edição manual ----------

export async function updateEmailFieldsAction(clientId: string, emailId: string, formData: FormData) {
  await requireClientAccess(clientId);

  const field = (name: string) => String(formData.get(name) ?? "").trim() || null;

  await db.marketingEmail.update({
    where: { id: emailId },
    data: {
      name: field("name") ?? undefined,
      subjectA: field("subjectA"),
      subjectB: field("subjectB"),
      preheader: field("preheader"),
      cardText: field("cardText"),
      body: field("body"),
      ctaText: field("ctaText"),
      farewell: field("farewell"),
      audience: field("audience"),
      senderName: field("senderName"),
      senderEmail: field("senderEmail"),
      ctaColor: field("ctaColor"),
      imagesFolderUrl: field("imagesFolderUrl"),
    },
  });

  revalidateEmails(clientId);
}

export async function updateEmailStatusAction(clientId: string, emailId: string, status: EmailStatus) {
  await requireClientAccess(clientId);
  await db.marketingEmail.update({ where: { id: emailId }, data: { status } });
  revalidateEmails(clientId);
}
