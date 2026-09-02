import { db } from "@/lib/db";
import type { ActivityAction } from "@prisma/client";

export const ACTIVITY_LABELS: Record<ActivityAction, string> = {
  CONTEXT_UPDATED: "Contexto atualizado",
  KEYWORDS_RESEARCHED: "Pesquisa de palavras-chave realizada",
  BRIEFING_SAVED: "Briefing preenchido",
  THEMES_GENERATED: "Temas gerados",
  THEME_SELECTED: "Tema selecionado",
  THEME_DISCARDED: "Tema descartado",
  TEXT_GENERATED: "Texto gerado",
  TEXT_EDITED: "Texto editado",
  TEXT_APPROVED: "Texto aprovado",
  POST_PUBLISHED: "Post publicado",
  DEMAND_OPENED: "Mês aberto",
  PRODUCTION_CLOSED: "Produção finalizada",
  POST_SCHEDULED: "Agendamento registrado",
  CLIENT_FEEDBACK: "Feedback do cliente registrado",
};

// Registra uma ação para o painel admin (progresso, histórico, atividade da equipe).
// Nunca deve derrubar a ação principal do usuário — se o log falhar, só avisamos no console.
export async function logActivity(params: {
  clientId: string;
  userId: string;
  action: ActivityAction;
  detail?: string;
  period?: string;
}): Promise<void> {
  try {
    await db.activityLog.create({
      data: {
        clientId: params.clientId,
        userId: params.userId,
        action: params.action,
        detail: params.detail,
        period: params.period,
      },
    });
  } catch (error) {
    console.error("Falha ao registrar atividade:", error);
  }
}
