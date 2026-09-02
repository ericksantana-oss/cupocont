"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MESES, formatPeriod, parsePeriod, currentPeriod } from "@/lib/periodo";
import { abrirMesAction } from "@/app/(dashboard)/agendamentos/actions";

// Abre o fluxo de qualquer mês, inclusive um que ainda não tem nada salvo.
// Cada mês tem briefing, temas e textos próprios: escolher aqui não mistura nada.
//
// O nº da tarefa é pedido aqui porque é o momento em que a demanda do mês nasce — antes
// disso o mês não existia como registro, só indiretamente através do briefing.
export function AbrirMes({
  clientId,
  tarefaPorMes,
}: {
  clientId: string;
  // Nº já informado para cada mês, para não pedir de novo o que já foi respondido.
  tarefaPorMes: Record<string, string>;
}) {
  const router = useRouter();
  const atual = parsePeriod(currentPeriod());
  const [mes, setMes] = useState(atual.month);
  const [ano, setAno] = useState(atual.year);
  const [tarefa, setTarefa] = useState("");
  const [tarefaTocada, setTarefaTocada] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const anos = [atual.year - 1, atual.year, atual.year + 1];
  const period = formatPeriod(mes, ano);

  // Ao trocar de mês, mostra o número que aquele mês já tem — a menos que a pessoa já
  // tenha digitado algo, para não apagar o que ela escreveu.
  const jaSalvo = tarefaPorMes[period] ?? "";
  const valor = tarefaTocada ? tarefa : jaSalvo;

  async function abrir() {
    setErro(null);
    const numero = valor.trim();
    if (!numero) {
      setErro("Informe o número da tarefa deste mês.");
      return;
    }

    setSalvando(true);
    try {
      const dados = new FormData();
      dados.set("period", period);
      dados.set("taskNumber", numero);
      await abrirMesAction(clientId, dados);
      router.push(`/clients/${clientId}/conteudo?period=${period}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível abrir o mês.");
      setSalvando(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <label htmlFor="mes-fluxo" className="rotulo">
            Mês
          </label>
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
          <label htmlFor="ano-fluxo" className="rotulo">
            Ano
          </label>
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

        <div className="space-y-1.5">
          <label htmlFor="tarefa-fluxo" className="rotulo">
            Nº da tarefa
          </label>
          <Input
            id="tarefa-fluxo"
            value={valor}
            onChange={(e) => {
              setTarefaTocada(true);
              setTarefa(e.target.value);
            }}
            placeholder="92857"
            inputMode="numeric"
            className="w-[120px]"
          />
        </div>

        <Button type="button" onClick={abrir} disabled={salvando}>
          {salvando ? (
            <>
              <Loader2 className="mr-1.5 size-4 animate-spin" strokeWidth={1.5} />
              Abrindo
            </>
          ) : (
            <>
              Abrir mês
              <ArrowRight className="ml-1.5 size-4" strokeWidth={1.5} />
            </>
          )}
        </Button>
      </div>

      {erro ? (
        <p className="mt-2 text-xs text-risco">{erro}</p>
      ) : (
        <p className="mt-2 text-xs text-tinta-3">
          O número da tarefa é o da ferramenta de gestão. Ele entra no título da demanda e de cada post.
        </p>
      )}
    </div>
  );
}
