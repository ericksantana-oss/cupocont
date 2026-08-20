// Dias mínimos de posts já agendados no Facebook antes de soar o alerta — ajustável.
export const SCHEDULING_ALERT_THRESHOLD_DAYS = 2;

export type SchedulingAlert = {
  clientId: string;
  clientName: string;
  kind: "none" | "low";
  until: Date | null;
};

type ClientWithAccount = {
  id: string;
  name: string;
  instagramAccount: { pageId: string | null; facebookScheduledUntil: Date | null } | null;
};

// Só considera clientes com Facebook conectado — sem isso não há como saber o que está agendado no Meta.
export function buildSchedulingAlerts(clients: ClientWithAccount[]): SchedulingAlert[] {
  const thresholdMs = SCHEDULING_ALERT_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() + thresholdMs;

  const alerts: SchedulingAlert[] = [];
  for (const client of clients) {
    const account = client.instagramAccount;
    if (!account?.pageId) continue;

    if (!account.facebookScheduledUntil) {
      alerts.push({ clientId: client.id, clientName: client.name, kind: "none", until: null });
    } else if (account.facebookScheduledUntil.getTime() < cutoff) {
      alerts.push({ clientId: client.id, clientName: client.name, kind: "low", until: account.facebookScheduledUntil });
    }
  }
  return alerts;
}

// Descreve a data em palavras relativas (hoje/amanhã) quando possível, senão cai pra data formatada.
export function describeSchedulingUntil(until: Date): string {
  const untilDay = new Date(until).setHours(0, 0, 0, 0);
  const today = new Date().setHours(0, 0, 0, 0);
  const days = Math.round((untilDay - today) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "hoje";
  if (days === 1) return "amanhã";
  if (days === 2) return "depois de amanhã";
  return until.toLocaleDateString("pt-BR");
}
