import Link from "next/link";
import { CalendarDays, CheckCircle2, CircleDashed } from "lucide-react";
import { db } from "@/lib/db";
import { periodLabel } from "@/lib/periodo";
import { tituloDaDemanda } from "@/lib/demanda";
import { contarPendenciasDeAprovacao } from "@/lib/contentDemand";
import { finalizarProducaoAction, reabrirProducaoAction } from "@/app/(dashboard)/agendamentos/actions";
import { BotaoDeAcao } from "@/components/client/BotaoDeAcao";

// Cabeçalho do mês na tela de conteúdo: mostra o título da demanda como ele vai aparecer
// na ferramenta de gestão, e concentra o marco de "produção finalizada".
export async function DemandaCard({ clientId, period }: { clientId: string; period: string }) {
  const [demanda, client, pendencias] = await Promise.all([
    db.contentDemand.findUnique({
      where: { clientId_period: { clientId, period } },
      select: { taskNumber: true, productionClosedAt: true },
    }),
    db.client.findUnique({ where: { id: clientId }, select: { acronym: true } }),
    contarPendenciasDeAprovacao(clientId, period),
  ]);

  // Mês aberto antes deste campo existir, ou acessado direto pela URL. Não bloqueia o
  // fluxo de conteúdo: só avisa que sem o número não há demanda para agendar.
  if (!demanda) {
    return (
      <div className="cartao mt-6 flex flex-wrap items-center gap-3 border-alerta/40 bg-alerta/10 p-4 text-sm">
        <CircleDashed className="size-4 shrink-0 text-alerta" strokeWidth={1.5} />
        <p className="flex-1">
          Este mês não tem número de tarefa registrado, então ainda não é uma demanda e não pode ir para o
          agendamento.
        </p>
        <Link href={`/clients/${clientId}`} className="font-medium text-mata hover:underline">
          Informar o número
        </Link>
      </div>
    );
  }

  const titulo = tituloDaDemanda({ acronym: client?.acronym ?? null, taskNumber: demanda.taskNumber, period });
  const finalizada = demanda.productionClosedAt !== null;
  const tudoAprovado = pendencias.selecionados > 0 && pendencias.aprovados === pendencias.selecionados;

  return (
    <div className="cartao mt-6 p-4">
      {/* Em linha própria de propósito: disputando espaço com os botões, o título ficava
          truncado em "TES..." — e ele é justamente o que a pessoa vem conferir aqui. */}
      <p className="rotulo">Demanda</p>
      <p className="mt-0.5 break-all font-mono text-sm">{titulo}</p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-linha-2 pt-3">
        {finalizada ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-sm text-mata">
              <CheckCircle2 className="size-4" strokeWidth={1.5} />
              Produção finalizada
            </span>
            <Link
              href={`/clients/${clientId}/agendamentos?period=${period}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-mata hover:underline"
            >
              <CalendarDays className="size-4" strokeWidth={1.5} />
              Ir para o agendamento
            </Link>
            <BotaoDeAcao
              acao={reabrirProducaoAction.bind(null, clientId, period)}
              variant="ghost"
              rotulo="Reabrir"
              carregando="Reabrindo"
            />
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-tinta-3">
              {pendencias.aprovados} de {pendencias.selecionados} texto(s) aprovado(s)
            </span>
            <BotaoDeAcao
              acao={finalizarProducaoAction.bind(null, clientId, period)}
              disabled={!tudoAprovado}
              rotulo="Finalizar produção"
              carregando="Finalizando"
            />
          </div>
        )}
      </div>

      {!finalizada && (
        <p className="mt-2 text-xs text-tinta-3">
          {tudoAprovado
            ? `Ao finalizar, os posts recebem número (Post 1, Post 2...) e a demanda passa a aparecer no calendário de agendamento. A numeração não muda depois.`
            : `Aprove todos os textos de ${periodLabel(period)} para liberar o agendamento.`}
        </p>
      )}

      {finalizada && pendencias.aprovados < pendencias.selecionados && (
        <p className="mt-2 text-xs text-alerta">
          Há {pendencias.selecionados - pendencias.aprovados} texto(s) aprovado(s) depois do fechamento. Reabra e
          finalize de novo para numerá-los — os números já atribuídos não mudam.
        </p>
      )}
    </div>
  );
}
