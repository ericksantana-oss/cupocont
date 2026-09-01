import { db } from "@/lib/db";
import { currentPeriod, parsePeriod, formatPeriod } from "@/lib/periodo";
import { getInstagramMetrics, getInstagramPosts, getFacebookMetrics } from "@/lib/meta/insights";
import { getPagePostsInPeriod } from "@/lib/meta/graph";
import type { MetricasInstagram, PostInstagram } from "@/lib/meta/insights";
import type { PagePost } from "@/lib/meta/graph";
import type { Prisma } from "@prisma/client";

export function limitesDoPeriodo(period: string): { since: number; until: number } {
  const { month, year } = parsePeriod(period);
  return {
    since: Math.floor(new Date(year, month - 1, 1, 0, 0, 0).getTime() / 1000),
    until: Math.floor(new Date(year, month, 0, 23, 59, 59).getTime() / 1000),
  };
}

export function mesAnteriorA(period: string): string {
  const { month, year } = parsePeriod(period);
  const d = new Date(year, month - 2, 1);
  return formatPeriod(d.getMonth() + 1, d.getFullYear());
}

// Captura o relatório inteiro de um cliente num mês e grava.
//
// A API do Meta descarta insights antigos, então guardar é a única forma de o
// histórico sobreviver. Mês corrente é reescrito a cada execução; mês fechado é
// gravado com closed=true e não se mexe mais — a partir daí o relatório daquele
// mês vem do banco, não da API.
export async function capturarSnapshot(clientId: string, period: string): Promise<boolean> {
  const conta = await db.instagramAccount.findUnique({ where: { clientId } });
  if (!conta) return false;

  const janela = limitesDoPeriodo(period);
  const fechou = period < currentPeriod();

  const [ig, posts] = await Promise.all([
    getInstagramMetrics(conta.igUserId, conta.pageAccessToken, janela),
    getInstagramPosts(conta.igUserId, conta.pageAccessToken, janela),
  ]);

  const [fb, fbPosts] = conta.pageId
    ? await Promise.all([
        getFacebookMetrics(conta.pageId, conta.pageAccessToken, janela),
        getPagePostsInPeriod(conta.pageId, conta.pageAccessToken, janela.since, janela.until),
      ])
    : [null, [] as PagePost[]];

  const dados = {
    followers: ig.followers,
    mediaCount: ig.mediaCount,
    reach: ig.alcanceSomaDiaria,
    reachUnique: ig.alcanceUnicoPeriodo,
    views: ig.visualizacoes,
    profileViews: ig.visitasPerfil,
    accountsEngaged: ig.contasEngajadas,
    interactions: ig.interacoesTotais,
    websiteClicks: ig.cliquesNoSite,
    dailyReach: ig.serieAlcance as unknown as Prisma.InputJsonValue,
    posts: posts as unknown as Prisma.InputJsonValue,
    fbFollowers: fb?.seguidores ?? null,
    fbPageViews: fb?.visualizacoesPagina ?? null,
    fbEngagement: fb?.engajamentoPosts ?? null,
    fbNewFollowers: fb?.novosSeguidores ?? null,
    fbPosts: fbPosts as unknown as Prisma.InputJsonValue,
    closed: fechou,
  };

  await db.metricSnapshot.upsert({
    where: { clientId_period: { clientId, period } },
    create: { clientId, period, ...dados },
    update: dados,
  });

  return true;
}

export type SnapshotGuardado = {
  period: string;
  closed: boolean;
  capturedAt: Date;
  instagram: MetricasInstagram;
  posts: PostInstagram[];
  facebook: { seguidores: number | null; visualizacoesPagina: number | null; engajamentoPosts: number | null; novosSeguidores: number | null; temPermissaoInsights: boolean } | null;
  facebookPosts: PagePost[];
};

// Lê um mês do banco no mesmo formato que a API entrega, para a tela não precisar
// saber de onde veio o dado.
export async function lerSnapshot(clientId: string, period: string): Promise<SnapshotGuardado | null> {
  const s = await db.metricSnapshot.findUnique({ where: { clientId_period: { clientId, period } } });
  if (!s) return null;

  const temFb = s.fbPageViews != null || s.fbEngagement != null || s.fbNewFollowers != null;

  return {
    period: s.period,
    closed: s.closed,
    capturedAt: s.capturedAt,
    instagram: {
      followers: s.followers,
      mediaCount: s.mediaCount,
      alcanceSomaDiaria: s.reach,
      alcanceUnicoPeriodo: s.reachUnique,
      visualizacoes: s.views,
      visitasPerfil: s.profileViews,
      contasEngajadas: s.accountsEngaged,
      interacoesTotais: s.interactions,
      cliquesNoSite: s.websiteClicks,
      serieAlcance: (s.dailyReach as unknown as { date: string; value: number }[] | null) ?? [],
      serieVisualizacoes: [],
    },
    posts: (s.posts as unknown as PostInstagram[] | null) ?? [],
    facebook: s.fbFollowers != null || temFb
      ? {
          seguidores: s.fbFollowers,
          visualizacoesPagina: s.fbPageViews,
          engajamentoPosts: s.fbEngagement,
          novosSeguidores: s.fbNewFollowers,
          temPermissaoInsights: temFb,
        }
      : null,
    facebookPosts: (s.fbPosts as unknown as PagePost[] | null) ?? [],
  };
}

// Meses que já têm histórico gravado, do mais recente para o mais antigo.
export async function listarMesesComHistorico(clientId: string) {
  return db.metricSnapshot.findMany({
    where: { clientId },
    orderBy: { period: "desc" },
    select: { period: true, closed: true, capturedAt: true, reach: true },
  });
}
