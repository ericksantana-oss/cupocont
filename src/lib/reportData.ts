import { db } from "@/lib/db";
import { generateDashboardInsights } from "@/lib/ai/prompts/generateDashboardInsights";
import {
  getInstagramMetrics,
  getInstagramPosts,
  getFacebookMetrics,
  type MetricasInstagram,
  type MetricasFacebook,
  type PostInstagram,
} from "@/lib/meta/insights";
import { getPagePostsInPeriod, type PagePost } from "@/lib/meta/graph";
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

// Período anterior de mesma duração, imediatamente antes — igual ao Reportei
// (01/08 a 31/08 compara com 01/07 a 31/07).
export function dateRangeUnix(from: string, to: string) {
  const sinceDate = parseDateInput(from);
  sinceDate.setHours(0, 0, 0, 0);
  const untilDate = parseDateInput(to);
  untilDate.setHours(23, 59, 59, 0);

  const dias = Math.round((untilDate.getTime() - sinceDate.getTime()) / 86400000) + 1;

  const prevUntilDate = new Date(sinceDate.getTime() - 86400000);
  prevUntilDate.setHours(23, 59, 59, 0);
  const prevSinceDate = new Date(prevUntilDate.getTime() - (dias - 1) * 86400000);
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

export function pctChange(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || previous === 0) return null;
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
  instagram: MetricasInstagram;
  instagramAnterior: MetricasInstagram;
  posts: PostInstagram[];
  stories: StoryInsight[];
  facebook: MetricasFacebook | null;
  facebookAnterior: MetricasFacebook | null;
  facebookPosts: PagePost[];
  insights: string[];
};

// Reúne tudo do relatório de resultados, separado por rede. Usado pela tela e pelo
// PDF, para os dois mostrarem exatamente os mesmos números.
export async function loadDashboardReportData(
  clientId: string,
  from: string,
  to: string
): Promise<DashboardReportData | null> {
  const client = await db.client.findUnique({ where: { id: clientId } });
  if (!client) return null;

  const account = await db.instagramAccount.findUnique({ where: { clientId } });
  if (!account) return null;

  const { since, until, prevSince, prevUntil, sinceDate, untilDate } = dateRangeUnix(from, to);
  const rangeLabel = `${sinceDate.toLocaleDateString("pt-BR")} a ${untilDate.toLocaleDateString("pt-BR")}`;

  const [instagram, instagramAnterior, posts, stories] = await Promise.all([
    getInstagramMetrics(account.igUserId, account.pageAccessToken, { since, until }),
    getInstagramMetrics(account.igUserId, account.pageAccessToken, { since: prevSince, until: prevUntil }),
    getInstagramPosts(account.igUserId, account.pageAccessToken, { since, until }),
    db.storyInsight.findMany({
      where: { clientId, timestamp: { gte: sinceDate, lte: untilDate } },
      orderBy: { timestamp: "desc" },
    }),
  ]);

  const [facebook, facebookAnterior, facebookPosts] = account.pageId
    ? await Promise.all([
        getFacebookMetrics(account.pageId, account.pageAccessToken, { since, until }),
        getFacebookMetrics(account.pageId, account.pageAccessToken, { since: prevSince, until: prevUntil }),
        getPagePostsInPeriod(account.pageId, account.pageAccessToken, since, until),
      ])
    : [null, null, [] as PagePost[]];

  const insights = await generateDashboardInsights({
    clientName: client.name,
    period: rangeLabel,
    reach: instagram.alcanceSomaDiaria ?? 0,
    prevReach: instagramAnterior.alcanceSomaDiaria ?? 0,
    profileViews: instagram.visitasPerfil ?? 0,
    prevProfileViews: instagramAnterior.visitasPerfil ?? 0,
    followers: instagram.followers ?? 0,
    media: posts.map((p) => ({
      id: p.id,
      caption: p.caption ?? undefined,
      media_type: p.mediaType,
      timestamp: p.timestamp,
      permalink: p.permalink,
      like_count: p.curtidas,
      comments_count: p.comentarios,
      reach: p.alcance,
      saved: p.salvos,
      shares: p.compartilhamentos,
    })),
  }).catch(() => []);

  return {
    client: { id: client.id, name: client.name },
    igUsername: account.igUsername,
    pageId: account.pageId,
    pageName: account.pageName,
    rangeLabel,
    from,
    to,
    instagram,
    instagramAnterior,
    posts,
    stories,
    facebook,
    facebookAnterior,
    facebookPosts,
    insights,
  };
}
