import { db } from "@/lib/db";
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
import type { StoryInsight } from "@prisma/client";

export const MEDIA_TYPE_LABEL: Record<string, string> = {
  IMAGE: "Imagem",
  VIDEO: "Vídeo",
  CAROUSEL_ALBUM: "Carrossel",
  REELS: "Reels",
};

export function parseDateInput(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function toInputValue(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function defaultRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: toInputValue(from), to: toInputValue(to) };
}

// Calcula o período anterior com a mesma duração, imediatamente antes do período escolhido —
// mesma lógica usada nos relatórios do Reportei (ex: 01/07 a 31/07 compara com 01/06 a 30/06).
export function dateRangeUnix(from: string, to: string) {
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

export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export type DashboardReportData = {
  client: { id: string; name: string };
  igUsername: string | null;
  pageId: string | null;
  pageName: string | null;
  rangeLabel: string;
  from: string;
  to: string;
  totals: { reach: number; profileViews: number };
  prevTotals: { reach: number; profileViews: number };
  followers: number | null;
  media: PeriodMedia[];
  dailyReach: { date: string; value: number }[];
  storyInsights: StoryInsight[];
  pageFollowers: number | null;
  pageTotals: { impressions: number; newFollowers: number; engagements: number } | null;
  prevPageTotals: { impressions: number; newFollowers: number; engagements: number } | null;
  pagePosts: PagePost[];
  insights: string[];
};

// Reúne todos os dados do dashboard de resultados (Instagram, Facebook, Stories, insights de IA)
// pra um cliente e período — usado tanto pela tela quanto pela exportação em PDF, garantindo os mesmos números.
export async function loadDashboardReportData(clientId: string, from: string, to: string): Promise<DashboardReportData | null> {
  const client = await db.client.findUnique({ where: { id: clientId } });
  if (!client) return null;

  const account = await db.instagramAccount.findUnique({ where: { clientId } });
  if (!account) return null;

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

  return {
    client: { id: client.id, name: client.name },
    igUsername: account.igUsername,
    pageId: account.pageId,
    pageName: account.pageName,
    rangeLabel,
    from,
    to,
    totals,
    prevTotals,
    followers: profile.followers_count ?? null,
    media,
    dailyReach,
    storyInsights,
    pageFollowers,
    pageTotals,
    prevPageTotals,
    pagePosts,
    insights,
  };
}
