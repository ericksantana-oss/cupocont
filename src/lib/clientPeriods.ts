import { db } from "@/lib/db";
import { SELECTED_THEMES_TARGET } from "@/lib/planningProgress";

export type PeriodoDoCliente = {
  period: string;
  themesGenerated: number;
  themesSelected: number;
  textsReady: number;
  textsApproved: number;
  percent: number;
};

// Lista os meses em que o cliente já tem fluxo começado, do mais recente para o mais
// antigo. Uma consulta só: computeClientProgress por mês seria N+1.
export async function listClientPeriods(clientId: string): Promise<PeriodoDoCliente[]> {
  const briefings = await db.briefing.findMany({
    where: { clientId },
    orderBy: { period: "desc" },
    include: { themes: { include: { texts: { orderBy: { version: "desc" }, take: 1 } } } },
  });

  return briefings.map((briefing) => {
    const selecionados = briefing.themes.filter((t) => t.status === "SELECTED");
    const textsReady = selecionados.filter((t) => t.texts.length > 0).length;
    const textsApproved = selecionados.filter((t) => t.texts[0]?.status === "APPROVED").length;

    // Mesmo peso para as três frentes que dependem do mês: selecionar temas,
    // gerar os textos e aprovar. O briefing salvo já garante um piso.
    const etapas = [
      1,
      Math.min(selecionados.length / SELECTED_THEMES_TARGET, 1),
      selecionados.length > 0 ? textsReady / selecionados.length : 0,
      selecionados.length > 0 ? textsApproved / selecionados.length : 0,
    ];

    return {
      period: briefing.period,
      themesGenerated: briefing.themes.length,
      themesSelected: selecionados.length,
      textsReady,
      textsApproved,
      percent: Math.round((etapas.reduce((a, b) => a + b, 0) / etapas.length) * 100),
    };
  });
}
