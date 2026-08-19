import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireClientAccess } from "@/lib/auth/guards";
import { currentPeriod, parsePeriod, periodLabel } from "@/lib/periodo";
import { PeriodSelect } from "@/components/client/PeriodSelect";
import { getAccountTotals, getProfileMetrics, getMediaInPeriod, type PeriodMedia } from "@/lib/meta/graph";

function monthRangeUnix(period: string) {
  const { month, year } = parsePeriod(period);
  const since = Math.floor(new Date(year, month - 1, 1, 0, 0, 0).getTime() / 1000);
  const until = Math.floor(new Date(year, month, 0, 23, 59, 59).getTime() / 1000);

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevSince = Math.floor(new Date(prevYear, prevMonth - 1, 1, 0, 0, 0).getTime() / 1000);
  const prevUntil = Math.floor(new Date(prevYear, prevMonth, 0, 23, 59, 59).getTime() / 1000);

  return { since, until, prevSince, prevUntil };
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

const MEDIA_TYPE_LABEL: Record<string, string> = {
  IMAGE: "Imagem",
  VIDEO: "Vídeo",
  CAROUSEL_ALBUM: "Carrossel",
  REELS: "Reels",
};

export default async function ClientDashboardPage({
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

  const account = await db.instagramAccount.findUnique({ where: { clientId } });

  const Header = (
    <>
      <Link href={`/clients/${clientId}`} className="inline-flex items-center text-sm text-tinta-3 hover:text-tinta">
        <ArrowLeft className="mr-1.5 size-4" strokeWidth={1.5} />
        {client.name}
      </Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
        <h1 className="display text-3xl">Dashboard de resultados</h1>
        <PeriodSelect period={period} />
      </div>
    </>
  );

  if (!account) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        {Header}
        <div className="cartao mt-8 p-8 text-center text-sm text-tinta-3">
          Conecte o Instagram do cliente na{" "}
          <Link href={`/clients/${clientId}/contexto`} className="text-mata underline">
            aba de Contexto
          </Link>{" "}
          para ver os resultados aqui.
        </div>
      </div>
    );
  }

  const { since, until, prevSince, prevUntil } = monthRangeUnix(period);

  const [totals, prevTotals, profile, media] = await Promise.all([
    getAccountTotals(account.igUserId, account.pageAccessToken, since, until),
    getAccountTotals(account.igUserId, account.pageAccessToken, prevSince, prevUntil),
    getProfileMetrics(account.igUserId, account.pageAccessToken),
    getMediaInPeriod(account.igUserId, account.pageAccessToken, since, until),
  ]);

  const reachDelta = pctChange(totals.reach, prevTotals.reach);
  const profileViewsDelta = pctChange(totals.profileViews, prevTotals.profileViews);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      {Header}
      <p className="mt-1 text-sm text-tinta-3">@{account.igUsername} — {periodLabel(period)}</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <MetricCard label="Seguidores atuais" value={profile.followers_count ?? "—"} />
        <MetricCard label="Alcance no período" value={totals.reach} delta={reachDelta} />
        <MetricCard label="Visitas ao perfil" value={totals.profileViews} delta={profileViewsDelta} />
      </div>

      <h2 className="mt-10 rotulo">Postagens do período ({media.length})</h2>
      <div className="cartao mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-linha bg-linha-2 text-left">
            <tr>
              <th className="p-3">Post</th>
              <th className="p-3">Tipo</th>
              <th className="p-3">Alcance</th>
              <th className="p-3">Curtidas</th>
              <th className="p-3">Comentários</th>
              <th className="p-3">Salvos</th>
              <th className="p-3">Compart.</th>
              <th className="p-3">Taxa interação</th>
            </tr>
          </thead>
          <tbody>
            {media.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-tinta-3">
                  Nenhuma postagem encontrada neste período.
                </td>
              </tr>
            )}
            {media.map((m) => (
              <MediaRow key={m.id} media={m} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MetricCard({ label, value, delta }: { label: string; value: number | string; delta?: number | null }) {
  return (
    <div className="cartao p-5">
      <p className="rotulo">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{typeof value === "number" ? value.toLocaleString("pt-BR") : value}</p>
      {delta != null && (
        <p className={`mt-1 text-xs ${delta >= 0 ? "text-mata" : "text-alerta"}`}>
          {delta >= 0 ? "+" : ""}
          {delta.toFixed(1)}% vs período anterior
        </p>
      )}
    </div>
  );
}

function MediaRow({ media }: { media: PeriodMedia }) {
  const interactions = media.like_count + media.comments_count + (media.saved ?? 0) + (media.shares ?? 0);
  const rate = media.reach ? (interactions / media.reach) * 100 : null;

  return (
    <tr className="border-b border-linha-2">
      <td className="max-w-xs truncate p-3">
        <a href={media.permalink} target="_blank" rel="noreferrer" className="hover:underline">
          {media.caption ? media.caption.slice(0, 60) : "(sem legenda)"}
        </a>
      </td>
      <td className="p-3">{MEDIA_TYPE_LABEL[media.media_type] ?? media.media_type}</td>
      <td className="p-3">{media.reach ?? "—"}</td>
      <td className="p-3">{media.like_count}</td>
      <td className="p-3">{media.comments_count}</td>
      <td className="p-3">{media.saved ?? "—"}</td>
      <td className="p-3">{media.shares ?? "—"}</td>
      <td className="p-3">{rate != null ? `${rate.toFixed(1)}%` : "—"}</td>
    </tr>
  );
}
