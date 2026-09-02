"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser, requireAdmin } from "@/lib/auth/guards";
import { listarConexoesComAviso, type ConexaoComAviso } from "@/lib/meta/tokenHealth";
import { validarSigla } from "@/lib/demanda";
import { listarAlertasDeCobertura, type AlertaDeCobertura } from "@/lib/coberturaDeAgendamento";

export async function createClientAction(formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const niche = String(formData.get("niche") ?? "").trim();
  const ownerId = String(formData.get("ownerId") ?? "").trim() || null;
  const squadId = String(formData.get("squadId") ?? "").trim() || null;

  if (!name || !niche) {
    throw new Error("Nome e nicho são obrigatórios.");
  }

  const sigla = validarSigla(String(formData.get("acronym") ?? ""));
  if (!sigla.ok) throw new Error(sigla.erro);

  const client = await db.client
    .create({ data: { name, niche, acronym: sigla.sigla, ownerId, squadId } })
    .catch((e) => {
      // Unicidade da sigla: mensagem útil em vez do erro cru do Prisma.
      if (e?.code === "P2002") throw new Error(`A sigla ${sigla.sigla} já está em uso por outro cliente.`);
      throw e;
    });

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

  const sigla = validarSigla(String(formData.get("acronym") ?? ""));
  if (!sigla.ok) throw new Error(sigla.erro);

  await db.client
    .update({ where: { id: clientId }, data: { name, niche, acronym: sigla.sigla, ownerId, squadId } })
    .catch((e) => {
      if (e?.code === "P2002") throw new Error(`A sigla ${sigla.sigla} já está em uso por outro cliente.`);
      throw e;
    });

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
//
// Cliente ARQUIVADO fica fora por padrão. O corte mora aqui, e não em cada consulta, para
// que arquivar realmente tire o cliente da operação — lista, alertas, agendamento e busca
// — sem depender de alguém lembrar de somar o filtro. Quem precisa ver arquivado pede
// explicitamente (guia Clientes).
function accessFilterFor(
  user: { id: string; role: string; squadId: string | null },
  opcoes: { incluirArquivados?: boolean } = {}
) {
  const arquivo = opcoes.incluirArquivados ? {} : { archivedAt: null };
  if (user.role === "ADMIN" || user.role === "INTERN") return arquivo;
  return {
    ...arquivo,
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

// Conexões do Meta que precisam de atenção, entre os clientes que esta pessoa vê.
// Passa os ids adiante em vez de consultar todas as contas: um aviso global revelaria
// a existência de cliente de outro squad.
export async function listAvisosDeConexao(): Promise<ConexaoComAviso[]> {
  const user = await requireUser();
  const clients = await db.client.findMany({ where: accessFilterFor(user), select: { id: true } });
  return listarConexoesComAviso(clients.map((c) => c.id));
}

// Até quando cada cliente tem post agendado. Usa o MESMO accessFilterFor do resto da
// ferramenta: admin e estagiário veem todos os clientes, redator vê os do próprio squad
// mais os liberados via ClientAccess.
export async function listAlertasDeCobertura(): Promise<AlertaDeCobertura[]> {
  const user = await requireUser();
  const clientes = await db.client.findMany({
    where: accessFilterFor(user),
    select: { id: true, name: true },
  });
  return listarAlertasDeCobertura(clientes);
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

// Notícias do mercado imobiliário (feed externo, atualizado 1x/dia pelo cron) — mesmo pra todo mundo.
export async function listMarketNews(limit = 6) {
  await requireUser();
  return db.marketNews.findMany({ orderBy: { pubDate: "desc" }, take: limit });
}

// Arquivar em vez de excluir. Excluir um cliente apaga em cascata os meses de métricas
// congeladas — dado que o Meta já descartou e não devolve nem reconectando. Arquivar
// tira da operação e preserva o histórico.
export async function arquivarClienteAction(clientId: string) {
  await requireAdmin();
  await db.client.update({ where: { id: clientId }, data: { archivedAt: new Date() } });
  revalidatePath("/clients");
  revalidatePath("/clientes");
  revalidatePath("/agendamentos");
}

export async function desarquivarClienteAction(clientId: string) {
  await requireAdmin();
  await db.client.update({ where: { id: clientId }, data: { archivedAt: null } });
  revalidatePath("/clients");
  revalidatePath("/clientes");
  revalidatePath("/agendamentos");
}

// Edição rápida da guia Clientes: só nome, sigla e responsável. O cadastro completo
// continua em Editar cliente — esta é para corrigir uma sigla sem trocar de tela.
export async function edicaoRapidaAction(clientId: string, formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("O nome é obrigatório.");

  const sigla = validarSigla(String(formData.get("acronym") ?? ""));
  if (!sigla.ok) throw new Error(sigla.erro);

  const ownerId = String(formData.get("ownerId") ?? "").trim() || null;

  await db.client
    .update({ where: { id: clientId }, data: { name, acronym: sigla.sigla, ownerId } })
    .catch((e) => {
      if (e?.code === "P2002") throw new Error(`A sigla ${sigla.sigla} já está em uso por outro cliente.`);
      throw e;
    });

  if (ownerId) {
    await db.clientAccess.upsert({
      where: { userId_clientId: { userId: ownerId, clientId } },
      create: { userId: ownerId, clientId },
      update: {},
    });
  }

  revalidatePath("/clientes");
  revalidatePath("/clients");
}

export interface ClienteNaLista {
  id: string;
  name: string;
  acronym: string | null;
  niche: string;
  ownerId: string | null;
  ownerName: string | null;
  squadName: string | null;
  archivedAt: Date | null;
  temInstagram: boolean;
  postsNoMes: number;
}

// Lista para a guia Clientes. Uma consulta com os contadores, em vez de somar por cliente.
export async function listarClientesParaGestao(incluirArquivados: boolean): Promise<ClienteNaLista[]> {
  const user = await requireUser();

  const clientes = await db.client.findMany({
    where: accessFilterFor(user, { incluirArquivados }),
    orderBy: [{ archivedAt: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      acronym: true,
      niche: true,
      ownerId: true,
      archivedAt: true,
      owner: { select: { name: true } },
      squad: { select: { name: true } },
      instagramAccount: { select: { id: true } },
      _count: { select: { themes: true } },
    },
  });

  return clientes.map((c) => ({
    id: c.id,
    name: c.name,
    acronym: c.acronym,
    niche: c.niche,
    ownerId: c.ownerId,
    ownerName: c.owner?.name ?? null,
    squadName: c.squad?.name ?? null,
    archivedAt: c.archivedAt,
    temInstagram: c.instagramAccount !== null,
    postsNoMes: c._count.themes,
  }));
}
