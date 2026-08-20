import Link from "next/link";
import { ArrowLeft, ArrowUpDown, Sparkles } from "lucide-react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireClientAccess } from "@/lib/auth/guards";
import { DateRangeSelect } from "@/components/client/DateRangeSelect";
import { ReachLineChart, ComparisonBarChart } from "@/components/client/DashboardCharts";
import { generateDashboardInsights } from "@/lib/ai/prompts/generateDashboardInsights";
import {
  getAccountTotals,
  getProfileMetrics,
  getMediaInPeriod,
  getDailyReach,
  getPageFollowers,
  getPageTotals,
  getPagePostsInPeriod,
  type PeriodMedia,
  type PagePost,
} from "@/lib/meta/graph";

function parseDateInput(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function toInputValue(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function defaultRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: toInputValue(from), to: toInputValue(to) };
}

// Calcula o período anterior com a mesma duração, imediatamente antes do período escolhido —
// mesma lógica usada nos relatórios do Reportei (ex: 01/07 a 31/07 compara com 01/06 a 30/06).
function dateRangeUnix(from: string, to: string) {
  const sinceDate = parseDateInput(from);
  sinceDate.setHours(0, 0, 0, 0);
  const untilDate = parseDateInput(to);
  untilDate.setHours(23, 59, 59, 0);

  const days = Math.round((untilDate.getTime() - sinceDate.getTime()) / (24 * 60 * 60 * 1000)) + 1;

  const prevUntilDate = new Date(sinceDate.getTime() - 24 * 60 * 60 * 1000);
  prevUntilDate.setHours(23, 59, 59, 0);
  const prevSinceDate = new Date(prevUntilDate.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  prevSinceDate.setHours(0, 0, 0, 0);

  return {
    since: Math.floor(sinceDate.getTime() / 1000),
    until: Math.floor(untilDate.getTime() / 1000),
    prevSince: Math.floor(prevSinceDate.getTime() / 1000),
    prevUntil: Math.floor(prevUntilDate.getTime() / 1000),
    sinceDate,
    untilDate,
  };
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

type SortKey = "date" | "reach" | "likes" | "comments" | "saved" | "shares" | "rate";

function sortMedia(media: PeriodMedia[], sort: SortKey, dir: "asc" | "desc") {
  const withComputed = media.map((m) => {
    const interactions = m.like_count + m.comments_count + (m.saved ?? 0) + (m.shares ?? 0);
    const rate = m.reach ? (interactions / m.reach) * 100 : -1;
    return { m, rate };
  });

  const value = (item: (typeof withComputed)[number]): number => {
    switch (sort) {
      case "date":
        return new Date(item.m.timestamp).getTime();
      case "reach":
        return item.m.reach ?? -1;
      case "likes":
        return item.m.like_count;
      case "comments":
        return item.m.comments_count;
      case "saved":
        return item.m.saved ?? -1;
      case "shares":
        return item.m.shares ?? -1;
      case "rate":
        return item.rate;
    }
  };

  withComputed.sort((a, b) => (dir === "asc" ? value(a) - value(b) : value(b) - value(a)));
  return withComputed.map((item) => item.m);
}

export default async function ClientDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ from?: string; to?: string; sort?: string; dir?: string }>;
}) {
  const { clientId } = await params;
  const defaults = defaultRange();
  const { from = defaults.from, to = defaults.to, sort = "date", dir = "desc" } = await searchParams;
  const sortKey = (["date", "reach", "likes", "comments", "saved", "shares", "rate"] as const).includes(
    sort as SortKey
  )
    ? (sort as SortKey)
    : "date";
  const sortDir = dir === "asc" ? "asc" : "desc";

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
        <DateRangeSelect from={from} to={to} />
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

  const { since, until, prevSince, prevUntil, sinceDate, untilDate } = dateRangeUnix(from, to);
  const rangeLabel = `${sinceDate.toLocaleDateString("pt-BR")} a ${untilDate.toLocaleDateString("pt-BR")}`;

  const [totals, prevTotals, profile, media, dailyReach, storyInsights] = await Promise.all([
    getAccountTotals(account.igUserId, account.pageAccessToken, since, until),
    getAccountTotals(account.igUserId, account.pageAccessToken, prevSince, prevUntil),
    getProfileMetrics(account.igUserId, account.pageAccessToken),
    getMediaInPeriod(account.igUserId, account.pageAccessToken, since, until),
    getDailyReach(account.igUserId, account.pageAccessToken, since, until),
    db.storyInsight.findMany({
      where: { clientId, timestamp: { gte: sinceDate, lte: untilDate } },
      orderBy: { timestamp: "desc" },
    }),
  ]);

  const [pageFollowers, pageTotals, prevPageTotals, pagePosts] = account.pageId
    ? await Promise.all([
        getPageFollowers(account.pageId, account.pageAccessToken),
        getPageTotals(account.pageId, account.pageAccessToken, since, until),
        getPageTotals(account.pageId, account.pageAccessToken, prevSince, prevUntil),
        getPagePostsInPeriod(account.pageId, account.pageAccessToken, since, until),
      ])
    : [null, null, null, [] as PagePost[]];

  const reachDelta = pctChange(totals.reach, prevTotals.reach);
  const profileViewsDelta = pctChange(totals.profileViews, prevTotals.profileViews);
  const sortedMedia = sortMedia(media, sortKey, sortDir);

  const insights = await generateDashboardInsights({
    clientName: client.name,
    period: rangeLabel,
    reach: totals.reach,
    prevReach: prevTotals.reach,
    profileViews: totals.profileViews,
    prevProfileViews: prevTotals.profileViews,
    followers: profile.followers_count ?? 0,
    media,
  }).catch(() => []);

  function sortLink(key: SortKey) {
    const nextDir = sortKey === key && sortDir === "desc" ? "asc" : "desc";
    return `/clients/${clientId}/dashboard?from=${from}&to=${to}&sort=${key}&dir=${nextDir}`;
  }

  const sumBy = <T,>(arr: T[], pick: (item: T) => number | null | undefined) =>
    arr.reduce((acc, item) => acc + (pick(item) ?? 0), 0);

  const postsByType = pagePosts.reduce<Record<string, { count: number; impressions: number; reactions: number }>>(
    (acc, post) => {
      const bucket = acc[post.postType] ?? { count: 0, impressions: 0, reactions: 0 };
      bucket.count += 1;
      bucket.impressions += post.impressions ?? 0;
      bucket.reactions += post.reactions;
      acc[post.postType] = bucket;
      return acc;
    },
    {}
  );
  const topPagePosts = [...pagePosts]
    .sort((a, b) => b.reactions + b.comments + b.shares - (a.reactions + a.comments + a.shares))
    .slice(0, 5);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      {Header}
      <p className="mt-1 text-sm text-tinta-3">
        @{account.igUsername} — {rangeLabel}
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <MetricCard label="Seguidores atuais" value={profile.followers_count ?? "—"} />
        <MetricCard label="Alcance no período" value={totals.reach} delta={reachDelta} />
        <MetricCard label="Visitas ao perfil" value={totals.profileViews} delta={profileViewsDelta} />
      </div>

      {insights.length > 0 && (
        <div className="cartao mt-6 p-6">
          <h2 className="flex items-center gap-1.5 rotulo">
            <Sparkles className="size-3.5" strokeWidth={1.5} />
            Insights do período
          </h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            {insights.map((line, i) => (
              <li key={i}>• {line}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="cartao p-5">
          <h2 className="rotulo">Alcance diário</h2>
          <div className="mt-2">
            <ReachLineChart data={dailyReach} />
          </div>
        </div>
        <div className="cartao p-5">
          <h2 className="rotulo">Comparativo com o período anterior</h2>
          <div className="mt-2">
            <ComparisonBarChart
              reach={totals.reach}
              prevReach={prevTotals.reach}
              profileViews={totals.profileViews}
              prevProfileViews={prevTotals.profileViews}
            />
          </div>
        </div>
      </div>

      <h2 className="mt-10 rotulo">Postagens do período ({media.length})</h2>
      <div className="cartao mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-linha bg-linha-2 text-left">
            <tr>
              <th className="p-3">Post</th>
              <th className="p-3">Tipo</th>
              <SortableHeader label="Data" sortKey="date" activeSort={sortKey} activeDir={sortDir} href={sortLink("date")} />
              <SortableHeader label="Alcance" sortKey="reach" activeSort={sortKey} activeDir={sortDir} href={sortLink("reach")} />
              <SortableHeader label="Curtidas" sortKey="likes" activeSort={sortKey} activeDir={sortDir} href={sortLink("likes")} />
              <SortableHeader label="Comentários" sortKey="comments" activeSort={sortKey} activeDir={sortDir} href={sortLink("comments")} />
              <SortableHeader label="Salvos" sortKey="saved" activeSort={sortKey} activeDir={sortDir} href={sortLink("saved")} />
              <SortableHeader label="Compart." sortKey="shares" activeSort={sortKey} activeDir={sortDir} href={sortLink("shares")} />
              <SortableHeader label="Taxa interação" sortKey="rate" activeSort={sortKey} activeDir={sortDir} href={sortLink("rate")} />
            </tr>
          </thead>
          <tbody>
            {sortedMedia.length === 0 && (
              <tr>
                <td colSpan={9} className="p-6 text-center text-tinta-3">
                  Nenhuma postagem encontrada neste período.
                </td>
              </tr>
            )}
            {sortedMedia.map((m) => (
              <MediaRow key={m.id} media={m} />
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 rotulo">Dados de Stories ({storyInsights.length})</h2>
      <p className="mt-1 text-xs text-tinta-3">
        A API do Meta só expõe Stories ativos (últimas 24h) — esse histórico vem de uma captura diária feita pela
        própria ferramenta, então só existem dados a partir do dia em que a conexão foi feita.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <MetricCard label="Stories no período" value={storyInsights.length} />
        <MetricCard label="Total de respostas" value={sumBy(storyInsights, (s) => s.replies)} />
        <MetricCard label="Total de interações" value={sumBy(storyInsights, (s) => s.interactions)} />
      </div>
      {storyInsights.length > 0 && (
        <div className="cartao mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-linha bg-linha-2 text-left">
              <tr>
                <th className="p-3">Data</th>
                <th className="p-3">Visualizações</th>
                <th className="p-3">Alcance</th>
                <th className="p-3">Interações</th>
                <th className="p-3">Respostas</th>
                <th className="p-3">Compart.</th>
                <th className="p-3">Avançar</th>
                <th className="p-3">Voltar</th>
                <th className="p-3">Saiu</th>
              </tr>
            </thead>
            <tbody>
              {storyInsights.map((s) => (
                <tr key={s.id} className="border-b border-linha-2">
                  <td className="p-3 whitespace-nowrap">{s.timestamp.toLocaleDateString("pt-BR")}</td>
                  <td className="p-3">{s.impressions ?? "—"}</td>
                  <td className="p-3">{s.reach ?? "—"}</td>
                  <td className="p-3">{s.interactions ?? "—"}</td>
                  <td className="p-3">{s.replies ?? "—"}</td>
                  <td className="p-3">{s.shares ?? "—"}</td>
                  <td className="p-3">{s.tapsForward ?? "—"}</td>
                  <td className="p-3">{s.tapsBack ?? "—"}</td>
                  <td className="p-3">{s.exits ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {account.pageId && (
        <>
          <h2 className="mt-10 rotulo">Dados gerais da página (Facebook)</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-4">
            <MetricCard label="Seguidores da página" value={pageFollowers ?? "—"} />
            <MetricCard
              label="Visualizadores"
              value={pageTotals?.impressions ?? 0}
              delta={pageTotals && prevPageTotals ? pctChange(pageTotals.impressions, prevPageTotals.impressions) : null}
            />
            <MetricCard
              label="Novos seguidores"
              value={pageTotals?.newFollowers ?? 0}
              delta={pageTotals && prevPageTotals ? pctChange(pageTotals.newFollowers, prevPageTotals.newFollowers) : null}
            />
            <MetricCard
              label="Engajamento das postagens"
              value={pageTotals?.engagements ?? 0}
              delta={pageTotals && prevPageTotals ? pctChange(pageTotals.engagements, prevPageTotals.engagements) : null}
            />
          </div>

          <h3 className="mt-8 rotulo">Performance por tipo de postagem</h3>
          <div className="cartao mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-linha bg-linha-2 text-left">
                <tr>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Postagens</th>
                  <th className="p-3">Visualizadores</th>
                  <th className="p-3">Reações</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(postsByType).length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-tinta-3">
                      Nenhuma postagem no Facebook neste período.
                    </td>
                  </tr>
                )}
                {Object.entries(postsByType).map(([type, data]) => (
                  <tr key={type} className="border-b border-linha-2">
                    <td className="p-3">{type}</td>
                    <td className="p-3">{data.count}</td>
                    <td className="p-3">{data.impressions}</td>
                    <td className="p-3">{data.reactions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="mt-8 rotulo">Postagens em destaque</h3>
          <div className="cartao mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-linha bg-linha-2 text-left">
                <tr>
                  <th className="p-3">Postagem</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Visualizadores</th>
                  <th className="p-3">Reações</th>
                  <th className="p-3">Comentários</th>
                  <th className="p-3">Compart.</th>
                </tr>
              </thead>
              <tbody>
                {topPagePosts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-tinta-3">
                      Nenhuma postagem no Facebook neste período.
                    </td>
                  </tr>
                )}
                {topPagePosts.map((post) => (
                  <tr key={post.id} className="border-b border-linha-2">
                    <td className="max-w-xs truncate p-3">
                      {post.permalink ? (
                        <a href={post.permalink} target="_blank" rel="noreferrer" className="hover:underline">
                          {post.message ? post.message.slice(0, 60) : "(sem legenda)"}
                        </a>
                      ) : (
                        post.message?.slice(0, 60) ?? "(sem legenda)"
                      )}
                    </td>
                    <td className="p-3">{post.postType}</td>
                    <td className="p-3">{post.impressions ?? "—"}</td>
                    <td className="p-3">{post.reactions}</td>
                    <td className="p-3">{post.comments}</td>
                    <td className="p-3">{post.shares}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function SortableHeader({
  label,
  sortKey,
  activeSort,
  activeDir,
  href,
}: {
  label: string;
  sortKey: SortKey;
  activeSort: SortKey;
  activeDir: "asc" | "desc";
  href: string;
}) {
  const isActive = sortKey === activeSort;
  return (
    <th className="p-3">
      <Link href={href} className={`inline-flex items-center gap-1 ${isActive ? "text-mata" : "hover:text-tinta"}`}>
        {label}
        <ArrowUpDown className="size-3" strokeWidth={1.5} />
        {isActive && <span className="text-xs">{activeDir === "asc" ? "↑" : "↓"}</span>}
      </Link>
    </th>
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
      <td className="p-3 whitespace-nowrap">{new Date(media.timestamp).toLocaleDateString("pt-BR")}</td>
      <td className="p-3">{media.reach ?? "—"}</td>
      <td className="p-3">{media.like_count}</td>
      <td className="p-3">{media.comments_count}</td>
      <td className="p-3">{media.saved ?? "—"}</td>
      <td className="p-3">{media.shares ?? "—"}</td>
      <td className="p-3">{rate != null ? `${rate.toFixed(1)}%` : "—"}</td>
    </tr>
  );
}
