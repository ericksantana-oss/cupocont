import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { currentPeriod, periodLabel } from "@/lib/periodo";
import {
  montarCalendario,
  gradeDoMes,
  coresPorCliente,
  mesAnterior,
  mesSeguinte,
} from "@/lib/agendamento";
import { CalendarioAgendamento } from "@/components/agendamento/CalendarioAgendamento";
import { FiltroDeClientes } from "@/components/agendamento/FiltroDeClientes";

// Tela de estado atual: precisa mostrar o que está no banco agora, não uma versão em
// cache de dois minutos atrás.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function AgendamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; clients?: string }>;
}) {
  const user = await requireUser();
  const { period = currentPeriod(), clients } = await searchParams;

  // Mesmo filtro de acesso do resto da ferramenta: redator vê os clientes do próprio
  // squad mais os liberados pontualmente.
  const acessiveis = await db.client.findMany({
    where:
      user.role === "ADMIN" || user.role === "INTERN"
        ? {}
        : {
            OR: [
              ...(user.squadId ? [{ squadId: user.squadId }] : []),
              { access: { some: { userId: user.id } } },
            ],
          },
    orderBy: { name: "asc" },
    select: { id: true, name: true, acronym: true },
  });

  // Sem seleção, mostra todos os que a pessoa pode ver. Ids que ela não pode ver são
  // descartados aqui, e não confiados ao que veio na URL.
  const pedidos = (clients ?? "").split(",").filter(Boolean);
  const selecionados = pedidos.length > 0 ? acessiveis.filter((c) => pedidos.includes(c.id)) : acessiveis;

  const { posts, demandas } = await montarCalendario(
    selecionados.map((c) => c.id),
    period
  );
  const { diasNoMes, primeiroDiaDaSemana } = gradeDoMes(period);

  const querystring = (p: string) =>
    `/agendamentos?period=${p}${pedidos.length > 0 ? `&clients=${pedidos.join(",")}` : ""}`;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="display text-3xl">Posts agendados</h1>
          <p className="mt-1 text-sm text-tinta-3">
            Registro manual do que já foi agendado no Business Suite. Nada aqui publica no Meta.
          </p>
        </div>
      </div>

      <div className="mt-8">
        <FiltroDeClientes
          clientes={acessiveis}
          selecionados={pedidos}
          period={period}
        />
      </div>

      {demandas.length === 0 ? (
        <div className="cartao mt-8 p-6">
          <p className="text-sm text-tinta-3">
            Nenhuma demanda com produção finalizada até {periodLabel(period)}. A demanda aparece aqui
            depois que o redator aprova os textos do mês e clica em &quot;Finalizar produção&quot; na tela
            de conteúdo do cliente.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-8">
            <h2 className="rotulo">Demandas em agendamento ({demandas.length})</h2>
            <div className="cartao mt-3 divide-y divide-linha-2">
              {demandas.map((demanda) => (
                <div key={demanda.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                  <span className="font-mono text-xs">{demanda.titulo}</span>
                  <span className="ml-auto text-xs text-tinta-3">{demanda.clientName}</span>
                </div>
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
              linkMesAnterior={querystring(mesAnterior(period))}
              linkMesSeguinte={querystring(mesSeguinte(period))}
              corPorCliente={coresPorCliente(selecionados.map((c) => c.id))}
            />
          </div>
        </>
      )}

      <p className="mt-8 text-xs text-tinta-3">
        Precisa do calendário de um cliente só?{" "}
        <Link href="/clients" className="text-mata hover:underline">
          Abra o cliente
        </Link>{" "}
        e use a aba Agendamentos.
      </p>
    </div>
  );
}
