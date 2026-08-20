"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

function toInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function firstDayOfMonth(offsetMonths: number): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1);
}

function lastDayOfMonth(offsetMonths: number): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + offsetMonths + 1, 0);
}

export function DateRangeSelect({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);

  function applyRange(nextFrom: string, nextTo: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", nextFrom);
    params.set("to", nextTo);
    router.push(`${pathname}?${params.toString()}`);
  }

  function applyPreset(offsetMonths: number) {
    const nextFrom = toInputValue(firstDayOfMonth(offsetMonths));
    const nextTo = toInputValue(lastDayOfMonth(offsetMonths));
    setDraftFrom(nextFrom);
    setDraftTo(nextTo);
    applyRange(nextFrom, nextTo);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => applyPreset(0)}
          className="rounded-controle border border-linha bg-carta px-3 py-1.5 text-sm shadow-carta hover:bg-linha-2"
        >
          Este mês
        </button>
        <button
          type="button"
          onClick={() => applyPreset(-1)}
          className="rounded-controle border border-linha bg-carta px-3 py-1.5 text-sm shadow-carta hover:bg-linha-2"
        >
          Mês passado
        </button>
      </div>

      <div className="flex items-end gap-2">
        <div className="space-y-1.5">
          <label className="rotulo">De</label>
          <input
            type="date"
            value={draftFrom}
            onChange={(e) => setDraftFrom(e.target.value)}
            className="block rounded-controle border border-linha bg-carta px-3 py-1.5 text-sm shadow-carta"
          />
        </div>
        <div className="space-y-1.5">
          <label className="rotulo">Até</label>
          <input
            type="date"
            value={draftTo}
            onChange={(e) => setDraftTo(e.target.value)}
            className="block rounded-controle border border-linha bg-carta px-3 py-1.5 text-sm shadow-carta"
          />
        </div>
        <button
          type="button"
          onClick={() => applyRange(draftFrom, draftTo)}
          className="rounded-controle bg-mata px-3 py-1.5 text-sm font-medium text-papel shadow-carta hover:opacity-90"
        >
          Aplicar
        </button>
      </div>
    </div>
  );
}
