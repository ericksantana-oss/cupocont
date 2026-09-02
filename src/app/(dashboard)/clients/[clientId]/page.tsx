import Link from "next/link";
import { ArrowLeft, ArrowRight, BarChart3, BookOpen, CalendarClock, CalendarDays, GitBranch, Mail, Pencil } from "lucide-react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireClientAccess } from "@/lib/auth/guards";
import { listClientPeriods } from "@/lib/clientPeriods";
import { periodLabel } from "@/lib/periodo";
import { AbrirMes } from "@/components/client/AbrirMes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function ClientSelectorPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const user = await requireClientAccess(clientId);

  const client = await db.client.findUnique({ where: { id: clientId } });
  if (!client) notFound();

  const [periodos, demandas] = await Promise.all([
    listClientPeriods(clientId),
    db.contentDemand.findMany({
      where: { clientId },
      select: { period: true, taskNumber: true, productionClosedAt: true },
    }),
  ]);

  // Nº da tarefa por mês, para o campo não pedir de novo o que já foi respondido.
  const tarefaPorMes = Object.fromEntries(demandas.map((d) => [d.period, d.taskNumber]));
  const demandaPorMes = new Map(demandas.map((d) => [d.period, d]));

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/clients" className="inline-flex items-center text-sm text-tinta-3 hover:text-tinta">
        <ArrowLeft className="mr-1.5 size-4" strokeWidth={1.5} />
        Clientes
      </Link>

      <div className="mt-4 flex items-center gap-2">
        <h1 className="display text-3xl">{client.name}</h1>
        {user.role === "ADMIN" && (
          <Button asChild variant="ghost" size="icon">
            <Link href={`/clients/${clientId}/edit`} aria-label="Editar cliente">
              <Pencil className="size-4" strokeWidth={1.5} />
            </Link>
          </Button>
        )}
      </div>
      <p className="mt-1 text-sm text-tinta-3">{client.niche}</p>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        <Link href={`/clients/${clientId}/contexto`} className="inline-flex items-center text-sm font-medium text-mata">
          <BookOpen className="mr-1.5 size-4" strokeWidth={1.5} />
          Contexto do cliente (base de conhecimento + redes conectadas)
          <ArrowRight className="ml-1 size-4" strokeWidth={1.5} />
        </Link>
        <Link href={`/clients/${clientId}/dashboard`} className="inline-flex items-center text-sm font-medium text-mata">
          <BarChart3 className="mr-1.5 size-4" strokeWidth={1.5} />
          Dashboard de resultados
          <ArrowRight className="ml-1 size-4" strokeWidth={1.5} />
        </Link>
        <Link href={`/clients/${clientId}/agendamentos`} className="inline-flex items-center text-sm font-medium text-mata">
          <CalendarDays className="mr-1.5 size-4" strokeWidth={1.5} />
          Posts agendados (calendário do cliente)
          <ArrowRight className="ml-1 size-4" strokeWidth={1.5} />
        </Link>
      </div>

      <div className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="rotulo">Conteúdo para redes sociais por mês</p>
            <p className="mt-1 text-sm text-tinta-3">
              Cada mês tem briefing, temas e textos próprios. Dá para trabalhar vários em paralelo e alternar entre
              eles sem que um interfira no outro.
            </p>
          </div>
          <AbrirMes clientId={clientId} tarefaPorMes={tarefaPorMes} />
        </div>

        {periodos.length > 0 && (
          <div className="cartao mt-4 divide-y divide-linha-2">
            {periodos.map((p) => (
              <Link
                key={p.period}
                href={`/clients/${clientId}/conteudo?period=${p.period}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 hover:bg-bruma/10"
              >
                <span className="min-w-[150px] font-medium">
                  {periodLabel(p.period)}
                  {demandaPorMes.get(p.period) && (
                    <span className="ml-2 font-mono text-xs text-tinta-3">
                      #{demandaPorMes.get(p.period)!.taskNumber}
                    </span>
                  )}
                </span>
                <span className="flex-1 text-sm text-tinta-3">
                  {p.themesSelected} tema(s) selecionado(s) · {p.textsReady} texto(s) gerado(s) ·{" "}
                  {p.textsApproved} aprovado(s)
                </span>
                {demandaPorMes.get(p.period)?.productionClosedAt && (
                  <Badge variant="default">Produção finalizada</Badge>
                )}
                <Badge variant={p.percent === 100 ? "default" : "secondary"}>{p.percent}%</Badge>
                <ArrowRight className="size-4 text-tinta-3" strokeWidth={1.5} />
              </Link>
            ))}
          </div>
        )}
      </div>

      <p className="mt-10 rotulo">Outras produções</p>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <ChoiceCard
          href={`/clients/${clientId}/emails/novo?type=pontual`}
          icon={<Mail className="size-5 text-mata" strokeWidth={1.5} />}
          title="Disparo de e-mail pontual"
          description="Um e-mail avulso, gerado a partir de um mini-briefing."
        />
        <ChoiceCard
          href={`/clients/${clientId}/emails/novo?type=fluxo`}
          icon={<GitBranch className="size-5 text-mata" strokeWidth={1.5} />}
          title="Fluxo de e-mail"
          description="E-mail de um fluxo já planejado, mantendo continuidade com os anteriores."
        />
        <ChoiceCard
          href={`/clients/${clientId}/posts/novo`}
          icon={<CalendarClock className="size-5 text-mata" strokeWidth={1.5} />}
          title="Publicar post avulso"
          description="Publica pela própria ferramenta, sem passar pelo fluxo de temas. Não é o registro de agendamento — esse fica no calendário acima."
        />
      </div>

      <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
        <Link href={`/clients/${clientId}/emails`} className="inline-flex items-center text-sm font-medium text-mata">
          Ver histórico de e-mails
          <ArrowRight className="ml-1 size-4" strokeWidth={1.5} />
        </Link>
        <Link href={`/clients/${clientId}/posts`} className="inline-flex items-center text-sm font-medium text-mata">
          Ver fila de publicação pela ferramenta
          <ArrowRight className="ml-1 size-4" strokeWidth={1.5} />
        </Link>
      </div>
    </div>
  );
}

function ChoiceCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} className="cartao group p-6 transition-shadow hover:shadow-alto">
      <span className="flex size-10 items-center justify-center rounded-controle bg-bruma/25">{icon}</span>
      <h2 className="mt-4 font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-tinta-3">{description}</p>
    </Link>
  );
}
