import { requireAdmin } from "@/lib/auth/guards";
import { AdminTabNav } from "@/components/admin/AdminTabNav";
import { PeriodSelect } from "@/components/client/PeriodSelect";
import { currentPeriod, periodLabel } from "@/lib/periodo";
import { formatRelative } from "@/lib/formatDate";
import { getTeamOverview } from "../actions";

export default async function AdminTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requireAdmin();
  const { period = currentPeriod() } = await searchParams;
  const team = await getTeamOverview(period);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="display text-3xl">Painel admin</h1>
          <p className="mt-1 text-sm text-tinta-3">Carga de trabalho da equipe em {periodLabel(period)}.</p>
        </div>
        <PeriodSelect period={period} />
      </div>

      <div className="mt-8">
        <AdminTabNav active="/admin/equipe" />
        <div className="cartao mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-linha bg-linha-2 text-left">
              <tr>
                <th className="p-3">Pessoa</th>
                <th className="p-3">Clientes</th>
                <th className="p-3">Concluídos</th>
                <th className="p-3">Atrasados/incompletos</th>
                <th className="p-3">Última atividade</th>
              </tr>
            </thead>
            <tbody>
              {team.map((person) => (
                <tr key={person.userId} className="border-b border-linha-2">
                  <td className="p-3 font-medium">{person.name}</td>
                  <td className="p-3">{person.clientsCount}</td>
                  <td className="p-3 text-mata">{person.completedCount}</td>
                  <td className="p-3 text-alerta">{person.incompleteCount}</td>
                  <td className="p-3 text-tinta-3">{formatRelative(person.lastActivityAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
