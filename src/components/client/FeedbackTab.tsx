import Link from "next/link";
import { CalendarDays, CircleDashed, PencilLine, ThumbsDown, ThumbsUp } from "lucide-react";
import { db } from "@/lib/db";
import { periodLabel } from "@/lib/periodo";
import { tituloDoPost } from "@/lib/demanda";
import { listarPostsParaFeedback, resumirFeedback } from "@/lib/clientFeedback";
import { salvarFeedbackDoMesAction } from "@/app/(dashboard)/agendamentos/actions";
import { BotaoSubmit } from "@/components/client/BotaoDeAcao";

// Etapa 5: o que o cliente achou de cada post.
//
// Existe porque até aqui o fluxo assumia que o cliente aprovaria tudo. Serve a dois
// propósitos: post reprovado não vai para o agendamento, e o que o cliente disse volta
// nos prompts dos meses seguintes.
export async function FeedbackTab({ clientId, period }: { clientId: string; period: string }) {
  const [demanda, client, posts] = await Promise.all([
    db.contentDemand.findUnique({
      where: { clientId_period: { clientId, period } },
      select: { taskNumber: true, productionClosedAt: true },
    }),
    db.client.findUnique({ where: { id: clientId }, select: { acronym: true } }),
    listarPostsParaFeedback(clientId, period),
  ]);

  if (!demanda) {
    return (
      <div className="cartao flex flex-wrap items-center gap-3 p-6 text-sm">
        <CircleDashed className="size-4 shrink-0 text-alerta" strokeWidth={1.5} />
        <p className="flex-1">Este mês ainda não tem número de tarefa, então ainda não é uma demanda.</p>
        <Link href={`/clients/${clientId}`} className="font-medium text-mata hover:underline">
          Informar o número
        </Link>
      </div>
    );
  }

  if (!demanda.productionClosedAt) {
    return (
      <div className="cartao p-6">
        <p className="text-sm text-tinta-3">
          O feedback do cliente vem depois de finalizar a produção de {periodLabel(period)} — é a entrega
          fechada que vai para ele.
        </p>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="cartao p-6">
        <p className="text-sm text-tinta-3">Nenhum post selecionado neste mês.</p>
      </div>
    );
  }

  const resumo = resumirFeedback(posts);
  const acao = salvarFeedbackDoMesAction.bind(null, clientId, period);

  return (
    <div>
      <div className="cartao flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
        <span className="text-tinta-3">
          {resumo.aprovados} aprovado(s) · {resumo.ajustes} com ajuste · {resumo.reprovados} reprovado(s) ·{" "}
          {resumo.semFeedback} sem resposta
        </span>
        {resumo.reprovados > 0 && (
          <span className="text-tinta-2">Post reprovado não aparece no calendário de agendamento.</span>
        )}
        {resumo.ajustes > 0 && (
          <span className="text-tinta-2">
            Post com ajuste continua agendável — faça o ajuste antes de subir.
          </span>
        )}
        <Link
          href={`/clients/${clientId}/agendamentos?period=${period}`}
          className="ml-auto inline-flex items-center gap-1.5 font-medium text-mata hover:underline"
        >
          <CalendarDays className="size-4" strokeWidth={1.5} />
          Ir para o agendamento
        </Link>
      </div>

      <form action={acao} className="mt-4 space-y-3">
        {posts.map((post) => (
          <div key={post.themeId} className="cartao p-4">
            <p className="font-mono text-xs text-tinta-3">
              {tituloDoPost(
                { acronym: client?.acronym ?? null, taskNumber: demanda.taskNumber },
                { postIndex: post.postIndex, title: post.themeTitle }
              )}
            </p>
            <p className="mt-1 font-medium">{post.themeTitle}</p>

            <div className="mt-3 flex flex-wrap items-center gap-4">
              <label className="inline-flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name={`verdict_${post.themeId}`}
                  value="APPROVED"
                  defaultChecked={post.verdict === "APPROVED"}
                />
                <ThumbsUp className="size-4 text-mata" strokeWidth={1.5} />
                Aprovado
              </label>
              <label className="inline-flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name={`verdict_${post.themeId}`}
                  value="ADJUSTED"
                  defaultChecked={post.verdict === "ADJUSTED"}
                />
                <PencilLine className="size-4 text-alerta" strokeWidth={1.5} />
                Aprovado, mas pediu ajuste
              </label>
              <label className="inline-flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name={`verdict_${post.themeId}`}
                  value="REJECTED"
                  defaultChecked={post.verdict === "REJECTED"}
                />
                <ThumbsDown className="size-4 text-risco" strokeWidth={1.5} />
                Reprovado
              </label>
              {post.verdict === null && (
                <span className="text-xs text-tinta-3">Sem resposta do cliente ainda</span>
              )}
            </div>

            <textarea
              name={`comment_${post.themeId}`}
              defaultValue={post.comment ?? ""}
              rows={2}
              placeholder="O que o cliente falou deste post? O ajuste pedido e o motivo da reprovação são o que mais ensina a IA."
              className="mt-3 block w-full rounded-controle border border-linha bg-carta px-3 py-2 text-sm shadow-carta"
            />

            <label className="mt-2 flex items-start gap-2 text-xs text-tinta-3">
              <input type="checkbox" name={`rule_${post.themeId}`} className="mt-0.5" />
              <span>
                Guardar este comentário como regra fixa do cliente. Marque quando for algo que vale{" "}
                <strong>sempre</strong>, e não só neste post — a regra passa a valer em toda geração futura.
              </span>
            </label>
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-4">
          <BotaoSubmit rotulo="Salvar feedback" carregando="Salvando" />
          <p className="text-xs text-tinta-3">
            Post sem veredito escolhido fica sem registro, em vez de virar &quot;aprovado&quot; por omissão.
          </p>
        </div>
      </form>
    </div>
  );
}
