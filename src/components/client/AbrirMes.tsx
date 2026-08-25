"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MESES, formatPeriod, parsePeriod, currentPeriod } from "@/lib/periodo";

// Abre o fluxo de qualquer mês, inclusive um que ainda não tem nada salvo.
// Cada mês tem briefing, temas e textos próprios: escolher aqui não mistura nada.
export function AbrirMes({ clientId }: { clientId: string }) {
  const router = useRouter();
  const atual = parsePeriod(currentPeriod());
  const [mes, setMes] = useState(atual.month);
  const [ano, setAno] = useState(atual.year);

  const anos = [atual.year - 1, atual.year, atual.year + 1];

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1.5">
        <label htmlFor="mes-fluxo" className="rotulo">Mês</label>
        <select
          id="mes-fluxo"
          value={mes}
          onChange={(e) => setMes(Number(e.target.value))}
          className="block w-[140px] rounded-controle border border-linha bg-carta px-3 py-1.5 text-sm shadow-carta"
        >
          {MESES.map((nome, i) => (
            <option key={nome} value={i + 1}>
              {nome}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="ano-fluxo" className="rotulo">Ano</label>
        <select
          id="ano-fluxo"
          value={ano}
          onChange={(e) => setAno(Number(e.target.value))}
          className="block w-[100px] rounded-controle border border-linha bg-carta px-3 py-1.5 text-sm shadow-carta"
        >
          {anos.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <Button
        type="button"
        onClick={() => router.push(`/clients/${clientId}/conteudo?period=${formatPeriod(mes, ano)}`)}
      >
        Abrir mês
        <ArrowRight className="ml-1.5 size-4" strokeWidth={1.5} />
      </Button>
    </div>
  );
}
