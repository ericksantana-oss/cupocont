import { db } from "@/lib/db";
import { tituloDoPost } from "@/lib/demanda";
import { listarDemandasParaAgendar } from "@/lib/contentDemand";

// Leitura do calendário de agendamentos.
//
// Nada aqui fala com o Meta. Todo registro veio de alguém anotando na mão o que já
// agendou no Business Suite — o Meta não expõe essa fila por API (docs/aprendizados.txt).

export interface PostAgendado {
  id: string;
  themeId: string;
  clientId: string;
  clientName: string;
  demandId: string;
  titulo: string;
  rotuloCurto: string;
  themeTitle: string;
  postIndex: number | null;
  period: string;
  scheduledFor: Date;
}

// O calendário é montado por DIA local, e o dia é a chave dos agrupamentos na tela.
// Guardar e comparar por ISO completo faria um post agendado às 21h aparecer no dia
// seguinte para quem estiver em outro fuso.
export function chaveDoDia(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

// Meio-dia local em vez de meia-noite: uma data salva à meia-noite e lida em outro fuso
// escorrega para o dia anterior. Com meio-dia, qualquer fuso do Brasil cai no mesmo dia.
export function diaParaData(chave: string): Date {
  const [ano, mes, dia] = chave.split("-").map(Number);
  return new Date(ano, mes - 1, dia, 12, 0, 0, 0);
}

// Rótulo mínimo que ainda identifica o post numa célula de ~60px. Sem isto, "truncate"
// no título completo não deixava NADA visível dentro do dia — verificado na tela.
export function rotuloCurto(acronym: string | null, postIndex: number | null): string {
  const sigla = acronym ?? "???";
  return postIndex === null ? sigla : `${sigla} Post ${postIndex}`;
}

export async function listarAgendamentos(
  clientIds: string[],
  janela: { de: Date; ate: Date }
): Promise<PostAgendado[]> {
  if (clientIds.length === 0) return [];

  const registros = await db.postSchedule.findMany({
    where: {
      clientId: { in: clientIds },
      scheduledFor: { gte: janela.de, lte: janela.ate },
    },
    orderBy: { scheduledFor: "asc" },
    select: {
      id: true,
      themeId: true,
      clientId: true,
      demandId: true,
      scheduledFor: true,
      client: { select: { name: true, acronym: true } },
      demand: { select: { taskNumber: true, period: true } },
      theme: { select: { title: true, postIndex: true } },
    },
  });

  return registros.map((r) => ({
    id: r.id,
    themeId: r.themeId,
    clientId: r.clientId,
    clientName: r.client.name,
    demandId: r.demandId,
    titulo: tituloDoPost(
      { acronym: r.client.acronym, taskNumber: r.demand.taskNumber },
      { postIndex: r.theme.postIndex, title: r.theme.title }
    ),
    rotuloCurto: rotuloCurto(r.client.acronym, r.theme.postIndex),
    themeTitle: r.theme.title,
    postIndex: r.theme.postIndex,
    period: r.demand.period,
    scheduledFor: r.scheduledFor,
  }));
}

// Primeiro e último instante do mês, em hora local, para a janela do calendário.
export function limitesDoMes(period: string): { de: Date; ate: Date } {
  const [ano, mes] = period.split("-").map(Number);
  return {
    de: new Date(ano, mes - 1, 1, 0, 0, 0, 0),
    ate: new Date(ano, mes, 0, 23, 59, 59, 999),
  };
}

// Quantos dias tem o mês e em qual dia da semana ele começa — o suficiente para a grade.
export function gradeDoMes(period: string): { diasNoMes: number; primeiroDiaDaSemana: number } {
  const [ano, mes] = period.split("-").map(Number);
  return {
    diasNoMes: new Date(ano, mes, 0).getDate(),
    primeiroDiaDaSemana: new Date(ano, mes - 1, 1).getDay(),
  };
}

// Monta tudo que o calendário precisa, para as duas telas (a do cliente e o painel
// geral). A diferença entre elas é só quais clientes entram.
export interface Calendario {
  posts: PostParaCalendario[];
  demandas: { id: string; titulo: string; clientName: string }[];
}

export interface PostParaCalendario {
  themeId: string;
  titulo: string;
  /** O que caber na célula do calendário: "ETM Post 1". O título inteiro fica no tooltip. */
  rotuloCurto: string;
  clientName: string;
  clientId: string;
  dia: string | null;
}

export async function montarCalendario(clientIds: string[], period: string): Promise<Calendario> {
  const fechadas = await listarDemandasParaAgendar(clientIds);

  // Demandas do mês exibido e dos anteriores. O que ainda não foi agendado num mês que
  // já passou continua aparecendo — some da tela seria a pior forma de esquecer.
  const relevantes = fechadas.filter((d) => d.period <= period);

  // Uma consulta para todos os meses envolvidos. Chamar lerDemanda por demanda era N+1
  // e chegou a deixar o botão "Finalizar produção" em 10s, porque toda ação revalida
  // esta tela.
  const briefings =
    relevantes.length === 0
      ? []
      : await db.briefing.findMany({
          where: { OR: relevantes.map((d) => ({ clientId: d.clientId, period: d.period })) },
          select: {
            clientId: true,
            period: true,
            themes: {
              where: { status: "SELECTED", postSchedule: null },
              orderBy: { postIndex: "asc" },
              select: { id: true, title: true, postIndex: true },
            },
          },
        });

  const porMes = new Map(briefings.map((b) => [`${b.clientId}|${b.period}`, b.themes]));

  const naoAgendados: PostParaCalendario[] = [];
  for (const demanda of relevantes) {
    for (const tema of porMes.get(`${demanda.clientId}|${demanda.period}`) ?? []) {
      naoAgendados.push({
        themeId: tema.id,
        titulo: tituloDoPost(demanda, { postIndex: tema.postIndex, title: tema.title }),
        rotuloCurto: rotuloCurto(demanda.acronym, tema.postIndex),
        clientName: demanda.clientName,
        clientId: demanda.clientId,
        dia: null,
      });
    }
  }

  // Já agendados vêm pela janela do mês, não pela demanda: um post de setembro agendado
  // para 1º de outubro precisa aparecer em outubro, onde ele está de fato.
  const agendados = await listarAgendamentos(clientIds, limitesDoMes(period));

  return {
    posts: [
      ...naoAgendados,
      ...agendados.map((a) => ({
        themeId: a.themeId,
        titulo: a.titulo,
        rotuloCurto: a.rotuloCurto,
        clientName: a.clientName,
        clientId: a.clientId,
        dia: chaveDoDia(a.scheduledFor),
      })),
    ],
    demandas: relevantes.map((d) => ({ id: d.id, titulo: d.titulo, clientName: d.clientName })),
  };
}

// Paleta para distinguir clientes no painel geral. Tons suaves de propósito: o cartão
// precisa deixar o texto legível, a cor é só para agrupar visualmente.
const CORES = [
  "bg-salvia/30",
  "bg-neon/20",
  "bg-bruma/50",
  "bg-alerta/20",
  "bg-mata/10",
  "bg-poco/20",
];

export function coresPorCliente(clientIds: string[]): Record<string, string> {
  return Object.fromEntries(clientIds.map((id, i) => [id, CORES[i % CORES.length]]));
}

export function mesAnterior(period: string): string {
  const [ano, mes] = period.split("-").map(Number);
  return mes === 1 ? `${ano - 1}-12` : `${ano}-${String(mes - 1).padStart(2, "0")}`;
}

export function mesSeguinte(period: string): string {
  const [ano, mes] = period.split("-").map(Number);
  return mes === 12 ? `${ano + 1}-01` : `${ano}-${String(mes + 1).padStart(2, "0")}`;
}
