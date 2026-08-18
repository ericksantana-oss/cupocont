import { Check, X, AlertTriangle } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { Badge } from "@/components/ui/badge";
import { AdminTabNav } from "@/components/admin/AdminTabNav";
import { PeriodSelect } from "@/components/client/PeriodSelect";
import { currentPeriod, periodLabel } from "@/lib/periodo";
import { formatRelative } from "@/lib/formatDate";
import { SELECTED_THEMES_TARGET } from "@/lib/planningProgress";
import { getClientsOverview, type ClientOverview } from "./actions";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requireAdmin();
  const { period = currentPeriod() } = await searchParams;
  const clients = await getClientsOverview(period);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="display text-3xl">Painel admin</h1>
          <p className="mt-1 text-sm text-tinta-3">
            Andamento do planejamento de {periodLabel(period)} por cliente.
          </p>
        </div>
        <PeriodSelect period={period} />
      </div>

      <div className="mt-8">
        <AdminTabNav active="/admin" />
        <div className="mt-6 space-y-4">
          {clients.length === 0 && <p className="text-sm text-tinta-3">Nenhum cliente cadastrado ainda.</p>}
          {clients.map((client) => (
            <ClientProgressCard key={client.clientId} client={client} />
          ))}
        </div>
      </div>
    </div>
  );
}

function StageRow({ label, done, warn }: { label: string; done: boolean; warn?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {done ? (
        <Check className="size-4 shrink-0 text-mata" strokeWidth={1.5} />
      ) : warn ? (
        <AlertTriangle className="size-4 shrink-0 text-alerta" strokeWidth={1.5} />
      ) : (
        <X className="size-4 shrink-0 text-tinta-3" strokeWidth={1.5} />
      )}
      <span className={done ? "text-tinta" : "text-tinta-2"}>{label}</span>
    </div>
  );
}

function ClientProgressCard({ client }: { client: ClientOverview }) {
  const { progress } = client;

  return (
    <div className="cartao p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{client.clientName}</h2>
          <p className="mt-0.5 text-sm text-tinta-3">
            Responsável: {client.ownerName ?? "sem responsável definido"}
          </p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2">
            {client.overdue && <Badge variant="destructive">Atrasado</Badge>}
            <span className="text-2xl font-semibold text-mata">{progress.percent}%</span>
          </div>
          <p className="text-xs text-tinta-3">Última atividade: {formatRelative(client.lastActivityAt)}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <StageRow label="Contexto atualizado" done={progress.contextDone} />
        <StageRow label="Palavras-chave pesquisadas" done={progress.keywordsDone} />
        <StageRow label="Briefing preenchido" done={progress.briefingDone} />
        <StageRow label="Temas gerados" done={progress.themesGeneratedDone} />
        <StageRow
          label={`Temas: ${progress.themesSelectedCount} de ${progress.themesGeneratedCount} selecionados`}
          done={progress.themesSelectedDone}
          warn={!progress.themesSelectedDone && progress.themesSelectedCount > 0}
        />
        <StageRow
          label={`Textos: ${progress.textsReadyCount} de ${progress.themesSelectedCount} prontos`}
          done={progress.themesSelectedCount > 0 && progress.textsReadyCount === progress.themesSelectedCount}
          warn={progress.themesSelectedCount > 0 && progress.textsReadyCount < progress.themesSelectedCount}
        />
        <StageRow
          label={`Aprovados: ${progress.textsApprovedCount} de ${progress.themesSelectedCount}`}
          done={progress.themesSelectedCount > 0 && progress.textsApprovedCount === progress.themesSelectedCount}
          warn={progress.themesSelectedCount > 0 && progress.textsApprovedCount < progress.themesSelectedCount}
        />
      </div>

      <p className="mt-4 text-xs text-tinta-3">Meta de temas selecionados por mês: {SELECTED_THEMES_TARGET}.</p>
    </div>
  );
}
