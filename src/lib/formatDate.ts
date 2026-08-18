export function formatRelative(date: Date | null): string {
  if (!date) return "nunca";

  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startOfDay(now).getTime() - startOfDay(date).getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "hoje";
  if (diffDays === 1) return "ontem";
  if (diffDays > 1 && diffDays < 7) return `há ${diffDays} dias`;

  return date.toLocaleDateString("pt-BR");
}

export function formatDateTime(date: Date): string {
  return date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
