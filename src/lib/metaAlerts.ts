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
  const now = Date.now();
  const cutoff = now + SCHEDULING_ALERT_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

  const alerts: SchedulingAlert[] = [];
  for (const client of clients) {
    const account = client.instagramAccount;
    if (!account?.pageId) continue;

    const until = account.facebookScheduledUntil;
    // Data no passado significa que não há nada agendado à frente — pode acontecer se o
    // cache ainda não foi atualizado pelo cron desde que o último post agendado venceu.
    const hasFutureSchedule = until != null && until.getTime() > now;

    if (!hasFutureSchedule) {
      alerts.push({ clientId: client.id, clientName: client.name, kind: "none", until: null });
    } else if (until!.getTime() < cutoff) {
      alerts.push({ clientId: client.id, clientName: client.name, kind: "low", until });
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
