import { db } from "@/lib/db";
import { parsePeriod, currentPeriod } from "@/lib/periodo";

// Meta de quantos temas o redator deve selecionar por mês para a etapa 5 "fechar".
export const SELECTED_THEMES_TARGET = 12;

export type ClientProgress = {
  contextDone: boolean;
  keywordsDone: boolean;
  briefingDone: boolean;
  themesGeneratedDone: boolean;
  themesGeneratedCount: number;
  themesSelectedCount: number;
  themesSelectedDone: boolean;
  textsReadyCount: number;
  textsApprovedCount: number;
  percent: number;
};

// O mês "vence" no dia 20: antes disso um planejamento incompleto é só "em andamento",
// depois disso já conta como atrasado.
export function isPeriodOverdue(period: string): boolean {
  const now = new Date();
  const { month, year } = parsePeriod(period);
  const periodStart = new Date(year, month - 1, 1);
  const currentStart = new Date(now.getFullYear(), now.getMonth(), 1);

  if (periodStart.getTime() < currentStart.getTime()) return true;
  if (periodStart.getTime() === currentStart.getTime()) return now.getDate() > 20;
  return false;
}

export async function computeClientProgress(clientId: string, period: string = currentPeriod()): Promise<ClientProgress> {
  const [documentsCount, keywordReportCount, briefing] = await Promise.all([
    db.clientDocument.count({ where: { clientId, status: "READY" } }),
    db.keywordReport.count({ where: { clientId, period } }),
    db.briefing.findUnique({
      where: { clientId_period: { clientId, period } },
      include: { themes: { include: { texts: { orderBy: { version: "desc" }, take: 1 } } } },
    }),
  ]);

  const themes = briefing?.themes ?? [];
  const selectedThemes = themes.filter((t) => t.status === "SELECTED");

  const contextDone = documentsCount > 0;
  const keywordsDone = keywordReportCount > 0;
  const briefingDone = !!briefing;
  const themesGeneratedCount = themes.length;
  const themesGeneratedDone = themesGeneratedCount > 0;
  const themesSelectedCount = selectedThemes.length;
  const themesSelectedDone = themesSelectedCount >= SELECTED_THEMES_TARGET;
  const textsReadyCount = selectedThemes.filter((t) => t.texts.length > 0).length;
  const textsApprovedCount = selectedThemes.filter((t) => t.texts[0]?.status === "APPROVED").length;

  const stages = [
    contextDone ? 1 : 0,
    keywordsDone ? 1 : 0,
    briefingDone ? 1 : 0,
    themesGeneratedDone ? 1 : 0,
    Math.min(themesSelectedCount / SELECTED_THEMES_TARGET, 1),
    themesSelectedCount > 0 ? textsReadyCount / themesSelectedCount : 0,
    themesSelectedCount > 0 ? textsApprovedCount / themesSelectedCount : 0,
  ];

  const percent = Math.round((stages.reduce((sum, s) => sum + s, 0) / stages.length) * 100);

  return {
    contextDone,
    keywordsDone,
    briefingDone,
    themesGeneratedDone,
    themesGeneratedCount,
    themesSelectedCount,
    themesSelectedDone,
    textsReadyCount,
    textsApprovedCount,
    percent,
  };
}
