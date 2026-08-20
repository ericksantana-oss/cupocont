import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { publishToInstagram, publishToFacebook, translateMetaError } from "@/lib/meta/publish";
import { getScheduledFacebookPosts } from "@/lib/meta/graph";
import { getPostMediaSignedUrl } from "@/lib/storage";

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

  const alertsRefreshed = await refreshFacebookSchedulingCache();

  return NextResponse.json({ processed: results.length, results, alertsRefreshed });
}

// Atualiza, pra cada cliente com Facebook conectado, até quando ele tem post agendado
// direto no Meta — usado pra montar os alertas da tela inicial sem chamar a API a cada acesso.
async function refreshFacebookSchedulingCache(): Promise<number> {
  const accounts = await db.instagramAccount.findMany({
    where: { pageId: { not: null } },
  });

  let refreshed = 0;
  await Promise.allSettled(
    accounts.map(async (account) => {
      const posts = await getScheduledFacebookPosts(account.pageId!, account.pageAccessToken);
      const lastPost = posts.at(-1);

      await db.instagramAccount.update({
        where: { id: account.id },
        data: {
          facebookScheduledUntil: lastPost ? new Date(lastPost.scheduledPublishTime) : null,
          facebookScheduledCount: posts.length,
          facebookScheduleCheckedAt: new Date(),
        },
      });
      refreshed += 1;
    })
  );

  return refreshed;
}
