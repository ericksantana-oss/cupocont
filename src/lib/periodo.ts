export const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function periodLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  const name = MESES[(month ?? 1) - 1] ?? "";
  return `${name} de ${year}`;
}

export function parsePeriod(period: string): { month: number; year: number } {
  const [year, month] = period.split("-").map(Number);
  return { month, year };
}

export function formatPeriod(month: number, year: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}
