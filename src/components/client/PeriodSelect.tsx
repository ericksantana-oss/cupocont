"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { MESES, parsePeriod, formatPeriod } from "@/lib/periodo";

export function PeriodSelect({ period }: { period: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { month, year } = parsePeriod(period);

  const years = [year - 1, year, year + 1];

  function updatePeriod(nextMonth: number, nextYear: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", formatPeriod(nextMonth, nextYear));
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-end gap-3">
      <div className="space-y-1.5">
        <label className="rotulo">Mês de trabalho</label>
        <select
          value={month}
          onChange={(e) => updatePeriod(Number(e.target.value), year)}
          className="block w-[150px] rounded-controle border border-linha bg-carta px-3 py-1.5 text-sm shadow-carta"
        >
          {MESES.map((name, i) => (
            <option key={name} value={i + 1}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <label className="rotulo">Ano</label>
        <select
          value={year}
          onChange={(e) => updatePeriod(month, Number(e.target.value))}
          className="block w-[110px] rounded-controle border border-linha bg-carta px-3 py-1.5 text-sm shadow-carta"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
