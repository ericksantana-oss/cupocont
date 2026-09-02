import { db } from "@/lib/db";
import { tituloDaDemanda, tituloDoPost } from "@/lib/demanda";

// Consultas da demanda do mês. A regra que importa aqui: a numeração dos posts é
// atribuída UMA vez, quando a produção é finalizada, e nunca recalculada.

export interface PostDaDemanda {
  themeId: string;
  postIndex: number | null;
  themeTitle: string;
  titulo: string;
  agendadoEm: Date | null;
}

export interface DemandaCompleta {
  id: string;
  clientId: string;
  clientName: string;
  acronym: string | null;
  taskNumber: string;
  period: string;
  titulo: string;
  producaoFinalizadaEm: Date | null;
  posts: PostDaDemanda[];
}

const SELECT_DEMANDA = {
  id: true,
  clientId: true,
  period: true,
  taskNumber: true,
  productionClosedAt: true,
  client: { select: { name: true, acronym: true } },
} as const;

// Os posts de uma demanda são os temas SELECTED do briefing daquele mês. O briefing é a
// chave do mês no fluxo de conteúdo; a demanda é a chave do mês no agendamento. As duas
// apontam para o mesmo cliente+período, então casam por ali.
async function postsDoPeriodo(clientId: string, period: string) {
  const briefing = await db.briefing.findUnique({
    where: { clientId_period: { clientId, period } },
    select: {
      themes: {
        where: { status: "SELECTED" },
        select: {
          id: true,
          title: true,
          postIndex: true,
          createdAt: true,
          postSchedule: { select: { scheduledFor: true } },
          texts: { orderBy: { version: "desc" }, take: 1, select: { status: true } },
        },
      },
    },
  });

  return briefing?.themes ?? [];
}

function montarPosts(
  demanda: { acronym: string | null; taskNumber: string },
  temas: Awaited<ReturnType<typeof postsDoPeriodo>>
): PostDaDemanda[] {
  return temas
    // Numerados primeiro, na ordem congelada. Tema que entrou depois de finalizar a
    // produção fica sem número e vai para o fim, em vez de se intercalar e confundir.
    .slice()
    .sort((a, b) => {
      if (a.postIndex !== null && b.postIndex !== null) return a.postIndex - b.postIndex;
      if (a.postIndex !== null) return -1;
      if (b.postIndex !== null) return 1;
      return a.createdAt.getTime() - b.createdAt.getTime();
    })
    .map((tema) => ({
      themeId: tema.id,
      postIndex: tema.postIndex,
      themeTitle: tema.title,
      titulo: tituloDoPost(demanda, { postIndex: tema.postIndex, title: tema.title }),
      agendadoEm: tema.postSchedule?.scheduledFor ?? null,
    }));
}

export async function lerDemanda(clientId: string, period: string): Promise<DemandaCompleta | null> {
  const demanda = await db.contentDemand.findUnique({
    where: { clientId_period: { clientId, period } },
    select: SELECT_DEMANDA,
  });
  if (!demanda) return null;

  const dados = { acronym: demanda.client.acronym, taskNumber: demanda.taskNumber, period };
  const temas = await postsDoPeriodo(clientId, period);

  return {
    id: demanda.id,
    clientId,
    clientName: demanda.client.name,
    acronym: demanda.client.acronym,
    taskNumber: demanda.taskNumber,
    period,
    titulo: tituloDaDemanda(dados),
    producaoFinalizadaEm: demanda.productionClosedAt,
    posts: montarPosts(dados, temas),
  };
}

// Quantos temas selecionados ainda não têm texto aprovado. Zero é a condição para
// finalizar a produção.
export async function contarPendenciasDeAprovacao(clientId: string, period: string): Promise<{
  selecionados: number;
  aprovados: number;
}> {
  const temas = await postsDoPeriodo(clientId, period);
  return {
    selecionados: temas.length,
    aprovados: temas.filter((t) => t.texts[0]?.status === "APPROVED").length,
  };
}

export interface DemandaResumida {
  id: string;
  clientId: string;
  clientName: string;
  // Sigla e nº da tarefa vão junto para quem precisa montar título de post sem uma
  // segunda consulta ao cliente e à demanda.
  acronym: string | null;
  taskNumber: string;
  period: string;
  titulo: string;
  totalDePosts: number;
  agendados: number;
}

// Demandas com produção finalizada, entre os clientes informados. É o que alimenta a
// tela de agendamento: demanda em produção não aparece lá de propósito, porque a
// numeração dos posts só existe depois de finalizar.
export async function listarDemandasParaAgendar(clientIds: string[]): Promise<DemandaResumida[]> {
  if (clientIds.length === 0) return [];

  const demandas = await db.contentDemand.findMany({
    where: { clientId: { in: clientIds }, productionClosedAt: { not: null } },
    orderBy: [{ period: "desc" }, { createdAt: "desc" }],
    select: SELECT_DEMANDA,
  });

  // Uma consulta para todos os briefings envolvidos, agrupada em memória. Chamar
  // postsDoPeriodo por demanda seria N+1 — mesmo cuidado de listClientPeriods.
  const briefings = await db.briefing.findMany({
    where: {
      OR: demandas.map((d) => ({ clientId: d.clientId, period: d.period })),
    },
    select: {
      clientId: true,
      period: true,
      themes: {
        where: { status: "SELECTED" },
        select: { id: true, postSchedule: { select: { id: true } } },
      },
    },
  });

  const porMes = new Map(briefings.map((b) => [`${b.clientId}|${b.period}`, b.themes]));

  return demandas.map((demanda) => {
    const temas = porMes.get(`${demanda.clientId}|${demanda.period}`) ?? [];
    return {
      id: demanda.id,
      clientId: demanda.clientId,
      clientName: demanda.client.name,
      acronym: demanda.client.acronym,
      taskNumber: demanda.taskNumber,
      period: demanda.period,
      titulo: tituloDaDemanda({
        acronym: demanda.client.acronym,
        taskNumber: demanda.taskNumber,
        period: demanda.period,
      }),
      totalDePosts: temas.length,
      agendados: temas.filter((t) => t.postSchedule !== null).length,
    };
  });
}
