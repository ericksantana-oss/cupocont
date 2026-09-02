import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireClientAccess } from "@/lib/auth/guards";
import { currentPeriod, periodLabel } from "@/lib/periodo";
import {
  montarCalendario,
  gradeDoMes,
  coresPorCliente,
  mesAnterior,
  mesSeguinte,
} from "@/lib/agendamento";
import { CalendarioAgendamento } from "@/components/agendamento/CalendarioAgendamento";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function ClientSchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { clientId } = await params;
  const { period = currentPeriod() } = await searchParams;

  await requireClientAccess(clientId);

  const client = await db.client.findUnique({ where: { id: clientId } });
  if (!client) notFound();

  const { posts, demandas } = await montarCalendario([clientId], period);
  const { diasNoMes, primeiroDiaDaSemana } = gradeDoMes(period);

  const link = (p: string) => `/clients/${clientId}/agendamentos?period=${p}`;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Link href={`/clients/${clientId}`} className="inline-flex items-center text-sm text-tinta-3 hover:text-tinta">
        <ArrowLeft className="mr-1.5 size-4" strokeWidth={1.5} />
        {client.name}
      </Link>

      <div className="mt-4">
        <h1 className="display text-3xl">Posts agendados</h1>
        <p className="mt-1 text-sm text-tinta-3">
          Registro manual do que já foi agendado no Business Suite. Nada aqui publica no Meta.
        </p>
      </div>

      {demandas.length === 0 ? (
        <div className="cartao mt-8 p-6">
          <p className="text-sm text-tinta-3">
            Este cliente não tem demanda com produção finalizada até {periodLabel(period)}.
          </p>
          <Link
            href={`/clients/${clientId}/conteudo?tab=textos&period=${period}`}
            className="mt-3 inline-block text-sm font-medium text-mata hover:underline"
          >
            Ir para os textos de {periodLabel(period)}
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-8">
            <h2 className="rotulo">Demandas em agendamento</h2>
            <div className="cartao mt-3 divide-y divide-linha-2">
              {demandas.map((demanda) => (
                <p key={demanda.id} className="p-3 font-mono text-xs">
                  {demanda.titulo}
                </p>
              ))}
            </div>
          </div>

          <div className="mt-8">
            <CalendarioAgendamento
              period={period}
              diasNoMes={diasNoMes}
              primeiroDiaDaSemana={primeiroDiaDaSemana}
              posts={posts}
              mesLabel={periodLabel(period)}
              linkMesAnterior={link(mesAnterior(period))}
              linkMesSeguinte={link(mesSeguinte(period))}
              corPorCliente={coresPorCliente([clientId])}
            />
          </div>
        </>
      )}
    </div>
  );
}
