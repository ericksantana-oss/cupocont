import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireClientAccess } from "@/lib/auth/guards";
import { BotaoGerar } from "@/components/client/BotaoGerar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createPontualEmailAction, createFluxoEmailAction, listEmailFlows } from "../actions";

export default async function NewEmailPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { clientId } = await params;
  const { type = "pontual" } = await searchParams;
  await requireClientAccess(clientId);

  const client = await db.client.findUnique({ where: { id: clientId } });
  if (!client) notFound();

  const isFluxo = type === "fluxo";
  const flows = isFluxo ? await listEmailFlows(clientId) : [];
  const action = isFluxo ? createFluxoEmailAction.bind(null, clientId) : createPontualEmailAction.bind(null, clientId);

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <Link href={`/clients/${clientId}`} className="inline-flex items-center text-sm text-tinta-3 hover:text-tinta">
        <ArrowLeft className="mr-1.5 size-4" strokeWidth={1.5} />
        {client.name}
      </Link>

      <h1 className="display mt-4 text-3xl">{isFluxo ? "Novo e-mail de fluxo" : "Novo disparo pontual"}</h1>
      <p className="mt-1 text-sm text-tinta-3">
        {isFluxo
          ? "O planejamento do fluxo já foi feito fora da ferramenta — aqui é só o direcionamento deste e-mail específico."
          : "Descreva o e-mail em poucas linhas — a IA cruza com tudo que já sabe sobre o cliente."}
      </p>

      <form action={action} className="cartao mt-6 space-y-4 p-6">
        {isFluxo && (
          <div className="space-y-2">
            <Label htmlFor="flowId">Fluxo</Label>
            <select
              id="flowId"
              name="flowId"
              className="block w-full rounded-controle border border-linha bg-carta px-3 py-1.5 text-sm shadow-carta"
            >
              <option value="">— nenhum fluxo existente selecionado —</option>
              {flows.map((flow) => (
                <option key={flow.id} value={flow.id}>
                  {flow.name}
                </option>
              ))}
            </select>
            <Input name="newFlowName" placeholder="ou nome de um novo fluxo (ex: Nutrição | pré-lançamento)" />
            <p className="text-xs text-tinta-3">
              Opcional, só para organização e histórico. Se escolher um fluxo existente, a IA lê os e-mails
              anteriores dele para manter continuidade.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="name">Nome {isFluxo ? "da etapa/e-mail" : "do e-mail"}</Label>
          <Input id="name" name="name" required placeholder={isFluxo ? "ex: Um lugar com alma" : "ex: Convite para evento de lançamento"} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="briefing">{isFluxo ? "Objetivo / direcionamento" : "Contexto / mini-briefing"}</Label>
          <Textarea
            id="briefing"
            name="briefing"
            rows={6}
            required
            placeholder={
              isFluxo
                ? "ex: Destacar o potencial de Pinhais, reforçando sua proximidade com Curitiba, a infraestrutura completa da região e o entorno privilegiado do empreendimento."
                : "ex: Convidar a base para o evento de lançamento da nova torre, dia 20/09, com CTA de confirmar presença."
            }
          />
        </div>

        <BotaoGerar label="Gerar e-mail" dica="São 5 etapas em sequência, cerca de 1 minuto." />
      </form>
    </div>
  );
}
