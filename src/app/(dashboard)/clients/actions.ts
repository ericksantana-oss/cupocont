"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, requireAdmin } from "@/lib/auth/guards";
import { buildSchedulingAlerts, type SchedulingAlert } from "@/lib/metaAlerts";

export async function createClientAction(formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const niche = String(formData.get("niche") ?? "").trim();
  const ownerId = String(formData.get("ownerId") ?? "").trim() || null;
  const squadId = String(formData.get("squadId") ?? "").trim() || null;

  if (!name || !niche) {
    throw new Error("Nome e nicho são obrigatórios.");
  }

  const client = await db.client.create({ data: { name, niche, ownerId, squadId } });

  if (ownerId) {
    await db.clientAccess.upsert({
      where: { userId_clientId: { userId: ownerId, clientId: client.id } },
      create: { userId: ownerId, clientId: client.id },
      update: {},
    });
  }

  revalidatePath("/clients");
  redirect(`/clients/${client.id}`);
}

export async function updateClientAction(clientId: string, formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const niche = String(formData.get("niche") ?? "").trim();
  const ownerId = String(formData.get("ownerId") ?? "").trim() || null;
  const squadId = String(formData.get("squadId") ?? "").trim() || null;

  if (!name || !niche) {
    throw new Error("Nome e nicho são obrigatórios.");
  }

  await db.client.update({ where: { id: clientId }, data: { name, niche, ownerId, squadId } });

  if (ownerId) {
    await db.clientAccess.upsert({
      where: { userId_clientId: { userId: ownerId, clientId } },
      create: { userId: ownerId, clientId },
      update: {},
    });
  }

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}

// Lista de redatores/admins para o seletor de "responsável" no cadastro do cliente.
export async function listWriters() {
  await requireAdmin();
  return db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, role: true } });
}

export async function listSquads() {
  await requireUser();
  return db.squad.findMany({ orderBy: { name: "asc" } });
}

export async function deleteClientAction(clientId: string) {
  await requireAdmin();
  await db.client.delete({ where: { id: clientId } });
  revalidatePath("/clients");
  redirect("/clients");
}

// Redator: cliente do próprio squad OU liberado pontualmente via ClientAccess.
// Admin/estagiário: todos os clientes.
function accessFilterFor(user: { id: string; role: string; squadId: string | null }) {
  if (user.role === "ADMIN" || user.role === "INTERN") return {};
  return {
    OR: [{ access: { some: { userId: user.id } } }, ...(user.squadId ? [{ squadId: user.squadId }] : [])],
  };
}

export async function listAccessibleClients(search?: string, squadId?: string) {
  const user = await requireUser();

  const searchFilter = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { niche: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  return db.client.findMany({
    where: { ...accessFilterFor(user), ...searchFilter, ...(squadId ? { squadId } : {}) },
    orderBy: { name: "asc" },
  });
}

export async function listRecentClients(squadId?: string) {
  const user = await requireUser();

  return db.client.findMany({
    where: { ...accessFilterFor(user), ...(squadId ? { squadId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 3,
  });
}

export type PendingApproval = {
  textId: string;
  themeTitle: string;
  period: string;
  clientId: string;
  clientName: string;
};

// Textos ainda em rascunho (última versão de cada tema selecionado), agrupados por
// cliente — o que falta revisar/aprovar sem precisar entrar cliente por cliente.
export async function listPendingApprovals(): Promise<PendingApproval[]> {
  const user = await requireUser();

  const themes = await db.contentTheme.findMany({
    where: { status: "SELECTED", client: accessFilterFor(user) },
    include: {
      client: { select: { id: true, name: true } },
      briefing: { select: { period: true } },
      texts: { orderBy: { version: "desc" }, take: 1 },
    },
  });

  return themes
    .filter((theme) => theme.texts[0]?.status === "DRAFT")
    .map((theme) => ({
      textId: theme.texts[0].id,
      themeTitle: theme.title,
      period: theme.briefing.period,
      clientId: theme.client.id,
      clientName: theme.client.name,
    }));
}

// Alertas de agendamento fraco/vazio no Facebook, compilados só pros clientes que o usuário atende.
export async function listSchedulingAlerts(): Promise<SchedulingAlert[]> {
  const user = await requireUser();

  const clients = await db.client.findMany({
    where: accessFilterFor(user),
    select: {
      id: true,
      name: true,
      instagramAccount: { select: { pageId: true, facebookScheduledUntil: true } },
    },
  });

  return buildSchedulingAlerts(clients);
}

// Notícias do mercado imobiliário (feed externo, atualizado 1x/dia pelo cron) — mesmo pra todo mundo.
export async function listMarketNews(limit = 6) {
  await requireUser();
  return db.marketNews.findMany({ orderBy: { pubDate: "desc" }, take: limit });
}
