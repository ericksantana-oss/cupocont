import { db } from "@/lib/db";

// Alerta de cobertura: até quando cada cliente tem post agendado.
//
// Esta é a segunda tentativa. A primeira (agosto/2026) lia a fila de agendamento do
// Business Suite e foi REMOVIDA porque o Meta não expõe essa fila por API — a tela
// afirmava "sem posts agendados" para todo mundo, sempre, e afirmar o contrário do que é
// verdade é pior que não ter tela. Ver docs/decisoes.txt (26/08/2026).
//
// Agora funciona porque o dado é outro: o próprio redator registra o agendamento na
// ferramenta. Não depende do Meta expor nada.

// "A dois dias do último post agendado". Constante nomeada porque este número é a
// primeira coisa que a operação vai querer ajustar depois de usar.
export const DIAS_PARA_AVISAR = 2;

const MS_POR_DIA = 86_400_000;

export type NivelDeCobertura = "sem-cobertura" | "acabando";

export interface AlertaDeCobertura {
  clientId: string;
  clientName: string;
  nivel: NivelDeCobertura;
  /** Último dia com post agendado. Nulo quando nunca houve agendamento. */
  ultimoDia: Date | null;
  diasRestantes: number | null;
  mensagem: string;
}

function inicioDoDia(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function diasEntre(de: Date, ate: Date): number {
  return Math.round((inicioDoDia(ate).getTime() - inicioDoDia(de).getTime()) / MS_POR_DIA);
}

// "até amanhã" lê melhor que "até 03/09" para o prazo curto, que é justamente onde o
// aviso precisa ser entendido de relance. De dois dias em diante entra a data, para não
// obrigar ninguém a contar.
function comoFalarDoDia(dias: number, dia: Date): string {
  if (dias <= 0) return "hoje";
  if (dias === 1) return "amanhã";
  return dia.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function montarMensagem(clientName: string, ultimoDia: Date | null, dias: number | null): string {
  if (ultimoDia === null) {
    return `${clientName} não tem nenhum post agendado.`;
  }
  if (dias !== null && dias < 0) {
    return `${clientName} não tem mais posts agendados — o último foi em ${ultimoDia.toLocaleDateString("pt-BR")}.`;
  }
  return `${clientName} só tem post agendado até ${comoFalarDoDia(dias ?? 0, ultimoDia)}.`;
}

// Recebe os ids que a pessoa pode ver, em vez de aplicar o filtro de acesso aqui: quem
// chama já tem o filtro da casa (accessFilterFor) e um segundo filtro paralelo seria
// uma regra a mais para sair de sincronia.
export async function listarAlertasDeCobertura(
  clientes: { id: string; name: string }[],
  agora = new Date()
): Promise<AlertaDeCobertura[]> {
  if (clientes.length === 0) return [];

  const ids = clientes.map((c) => c.id);

  // Só entram no alerta clientes que já finalizaram a produção de algum mês. Cliente que
  // nunca chegou ao agendamento não está atrasado, está por começar — e com 26 clientes,
  // alertar todos viraria um muro de avisos que ensina a ignorar a tela.
  const [comDemandaFechada, ultimoPorCliente] = await Promise.all([
    db.contentDemand.findMany({
      where: { clientId: { in: ids }, productionClosedAt: { not: null } },
      select: { clientId: true },
      distinct: ["clientId"],
    }),
    // Um groupBy em vez de uma consulta por cliente.
    db.postSchedule.groupBy({
      by: ["clientId"],
      where: { clientId: { in: ids } },
      _max: { scheduledFor: true },
    }),
  ]);

  const noFluxo = new Set(comDemandaFechada.map((d) => d.clientId));
  const ultimo = new Map(ultimoPorCliente.map((r) => [r.clientId, r._max.scheduledFor ?? null]));

  const alertas: AlertaDeCobertura[] = [];

  for (const cliente of clientes) {
    if (!noFluxo.has(cliente.id)) continue;

    const ultimoDia = ultimo.get(cliente.id) ?? null;
    const dias = ultimoDia === null ? null : diasEntre(agora, ultimoDia);

    // Sem nenhum registro, ou o último dia coberto já passou.
    if (ultimoDia === null || (dias !== null && dias < 0)) {
      alertas.push({
        clientId: cliente.id,
        clientName: cliente.name,
        nivel: "sem-cobertura",
        ultimoDia,
        diasRestantes: dias,
        mensagem: montarMensagem(cliente.name, ultimoDia, dias),
      });
      continue;
    }

    if (dias !== null && dias <= DIAS_PARA_AVISAR) {
      alertas.push({
        clientId: cliente.id,
        clientName: cliente.name,
        nivel: "acabando",
        ultimoDia,
        diasRestantes: dias,
        mensagem: montarMensagem(cliente.name, ultimoDia, dias),
      });
    }
  }

  // Mais urgente primeiro: quem não tem cobertura, depois quem tem menos dias.
  return alertas.sort((a, b) => (a.diasRestantes ?? -999) - (b.diasRestantes ?? -999));
}
