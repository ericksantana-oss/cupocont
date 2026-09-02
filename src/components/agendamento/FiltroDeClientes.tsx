"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

// Filtro do painel geral: um cliente, vários ou todos.
//
// Botões que alternam, em vez de um <select multiple>: selecionar dois clientes num
// select múltiplo exige segurar Ctrl, o que praticamente ninguém descobre sozinho.
export function FiltroDeClientes({
  clientes,
  selecionados,
  period,
}: {
  clientes: { id: string; name: string; acronym: string | null }[];
  selecionados: string[];
  period: string;
}) {
  const router = useRouter();

  function irPara(ids: string[]) {
    const query = ids.length > 0 ? `&clients=${ids.join(",")}` : "";
    router.push(`/agendamentos?period=${period}${query}`);
  }

  function alternar(id: string) {
    // Lista vazia significa "todos". Ao clicar no primeiro cliente a partir de "todos",
    // o esperado é ver só aquele — não todos menos aquele.
    const base = selecionados.length === 0 ? [] : selecionados;
    irPara(base.includes(id) ? base.filter((x) => x !== id) : [...base, id]);
  }

  const todos = selecionados.length === 0;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={() => irPara([])}
        className={cn(
          "rounded-controle border px-3 py-1.5 text-xs font-medium transition-colors",
          todos ? "border-mata bg-mata/10 text-mata" : "border-linha text-tinta-3 hover:text-tinta"
        )}
      >
        Todos os clientes
      </button>

      {clientes.map((cliente) => {
        const ativo = selecionados.includes(cliente.id);
        return (
          <button
            key={cliente.id}
            type="button"
            onClick={() => alternar(cliente.id)}
            className={cn(
              "rounded-controle border px-3 py-1.5 text-xs font-medium transition-colors",
              ativo ? "border-mata bg-mata/10 text-mata" : "border-linha text-tinta-3 hover:text-tinta"
            )}
            title={cliente.name}
          >
            {cliente.acronym ?? cliente.name}
          </button>
        );
      })}
    </div>
  );
}
