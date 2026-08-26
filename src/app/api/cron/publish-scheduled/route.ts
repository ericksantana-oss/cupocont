import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { publishToInstagram, publishToFacebook, translateMetaError } from "@/lib/meta/publish";
import { getActiveStoriesInsights, getAccountTotals, getProfileMetrics } from "@/lib/meta/graph";
import { getPostMediaSignedUrl } from "@/lib/storage";
import { fetchAllMarketNews } from "@/lib/news/marketNews";
import { currentPeriod, parsePeriod } from "@/lib/periodo";

// No plano gratuito da Vercel o cron roda só 1x/dia, então essa rota
// precisa dar conta de vários posts vencidos numa única execução.
// 60s é o máximo permitido no plano Hobby para funções serverless.
export const maxDuration = 60;

const STALE_PUBLISHING_MINUTES = 10;

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  // Se uma execução anterior travou (ex: timeout) com um post preso em
  // "PUBLISHING", libera ele de volta pra "SCHEDULED" pra tentar de novo.
  const staleCutoff = new Date(Date.now() - STALE_PUBLISHING_MINUTES * 60 * 1000);
  await db.scheduledPost.updateMany({
    where: { status: "PUBLISHING", updatedAt: { lte: staleCutoff } },
    data: { status: "SCHEDULED" },
  });

  const due = await db.scheduledPost.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } },
    take: 10,
    include: { client: { include: { instagramAccount: true } } },
  });

  const results: { id: string; outcome: string }[] = [];

  for (const post of due) {
    // Reivindica o post antes de processar, pra evitar publicar duas vezes
    // se essa rota rodar de novo antes de terminar a anterior.
    const claimed = await db.scheduledPost.updateMany({
      where: { id: post.id, status: "SCHEDULED" },
      data: { status: "PUBLISHING" },
    });
    if (claimed.count === 0) continue;

    const account = post.client.instagramAccount;
    if (!account) {
      await db.scheduledPost.update({
        where: { id: post.id },
        data: {
          status: "ERROR",
          errorMessage: "É necessário reconectar a conta do Instagram/Facebook.",
          errorRaw: "Client has no InstagramAccount at publish time",
        },
      });
      results.push({ id: post.id, outcome: "error: no account" });
      continue;
    }

    try {
      const mediaPaths = post.mediaPaths as string[];
      const mediaUrls = await Promise.all(mediaPaths.map((p) => getPostMediaSignedUrl(p, 3600)));

      const result =
        post.channel === "INSTAGRAM"
          ? await publishToInstagram({
              igUserId: account.igUserId,
              pageAccessToken: account.pageAccessToken,
              format: post.format,
              caption: post.caption,
              mediaUrls,
            })
          : await publishToFacebook({
              pageId: account.pageId ?? "",
              pageAccessToken: account.pageAccessToken,
              format: post.format,
              caption: post.caption,
              mediaUrls,
            });

      await db.scheduledPost.update({
        where: { id: post.id },
        data: { status: "PUBLISHED", publishedAt: new Date(), permalink: result.permalink },
      });
      results.push({ id: post.id, outcome: "published" });
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : "Erro desconhecido.";
      await db.scheduledPost.update({
        where: { id: post.id },
        data: { status: "ERROR", errorMessage: translateMetaError(rawMessage), errorRaw: rawMessage },
      });
      results.push({ id: post.id, outcome: `error: ${rawMessage}` });
    }
  }

  const newsRefreshed = await refreshMarketNews();
  const storiesCaptured = await captureActiveStories();
  const snapshotsSaved = await captureMetricSnapshots();

  return NextResponse.json({ processed: results.length, results, newsRefreshed, storiesCaptured, snapshotsSaved });
}

// Grava o retrato das métricas do mês corrente para cada cliente conectado.
// Reescreve a cada execução: o mês vai se completando até fechar. Sem isto não
// existe histórico nenhum — o dashboard consulta o Meta ao vivo e não guarda nada,
// então cada mês sem captura é um mês que nunca poderá ser analisado.
async function captureMetricSnapshots(): Promise<number> {
  const accounts = await db.instagramAccount.findMany();
  const period = currentPeriod();
  const { month, year } = parsePeriod(period);
  const since = Math.floor(new Date(year, month - 1, 1, 0, 0, 0).getTime() / 1000);
  const until = Math.floor(new Date(year, month, 0, 23, 59, 59).getTime() / 1000);

  let saved = 0;
  await Promise.allSettled(
    accounts.map(async (account) => {
      const [totals, profile] = await Promise.all([
        getAccountTotals(account.igUserId, account.pageAccessToken, since, until),
        getProfileMetrics(account.igUserId, account.pageAccessToken),
      ]);

      const dados = {
        followers: profile.followers_count ?? null,
        mediaCount: profile.media_count ?? null,
        reach: totals.reach,
        profileViews: totals.profileViews,
      };

      await db.metricSnapshot.upsert({
        where: { clientId_period: { clientId: account.clientId, period } },
        create: { clientId: account.clientId, period, ...dados },
        update: dados,
      });
      saved += 1;
    })
  );

  return saved;
}

// A API do Meta só expõe Stories ativos (< 24h) — captura o instantâneo de agora e guarda,
// já que depois que o story expira esse dado some da API pra sempre.
async function captureActiveStories(): Promise<number> {
  const accounts = await db.instagramAccount.findMany();

  let captured = 0;
  await Promise.allSettled(
    accounts.map(async (account) => {
      const stories = await getActiveStoriesInsights(account.igUserId, account.pageAccessToken);
      for (const story of stories) {
        await db.storyInsight.upsert({
          where: { mediaId: story.mediaId },
          create: {
            clientId: account.clientId,
            mediaId: story.mediaId,
            timestamp: new Date(story.timestamp),
            impressions: story.impressions,
            reach: story.reach,
            interactions: story.interactions,
            replies: story.replies,
            shares: story.shares,
            tapsForward: story.tapsForward,
            tapsBack: story.tapsBack,
            exits: story.exits,
            profileVisits: story.profileVisits,
          },
          update: {
            impressions: story.impressions,
            reach: story.reach,
            interactions: story.interactions,
            replies: story.replies,
            shares: story.shares,
            tapsForward: story.tapsForward,
            tapsBack: story.tapsBack,
            exits: story.exits,
            profileVisits: story.profileVisits,
          },
        });
        captured += 1;
      }
    })
  );

  return captured;
}

const MARKET_NEWS_KEEP = 30;

// Busca o(s) feed(s) de notícias do mercado imobiliário e mantém só as mais recentes em cache.
async function refreshMarketNews(): Promise<number> {
  const items = await fetchAllMarketNews();

  await Promise.allSettled(
    items.map((item) =>
      db.marketNews.upsert({
        where: { guid: item.guid },
        create: { guid: item.guid, title: item.title, link: item.link, source: item.source, pubDate: item.pubDate },
        update: { title: item.title, link: item.link, pubDate: item.pubDate },
      })
    )
  );

  const stale = await db.marketNews.findMany({
    orderBy: { pubDate: "desc" },
    skip: MARKET_NEWS_KEEP,
    select: { id: true },
  });
  if (stale.length > 0) {
    await db.marketNews.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
  }

  return items.length;
}
