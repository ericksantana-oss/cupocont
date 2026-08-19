const GRAPH_VERSION = "v21.0";
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente ${name} não configurada.`);
  return value;
}

export function buildAuthorizeUrl(state: string): string {
  const appId = requireEnv("META_APP_ID");
  const redirectUri = requireEnv("META_REDIRECT_URI");

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state,
    response_type: "code",
    scope:
      "pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_manage_insights,instagram_content_publish,business_management",
  });

  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}

export async function graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${GRAPH_URL}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const res = await fetch(url.toString());
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? "Erro ao consultar a API do Meta.");
  return data as T;
}

export async function graphPost<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${GRAPH_URL}${path}`);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? "Erro ao publicar na API do Meta.");
  return data as T;
}

export async function exchangeCodeForUserToken(code: string): Promise<string> {
  const data = await graphGet<{ access_token: string }>("/oauth/access_token", {
    client_id: requireEnv("META_APP_ID"),
    client_secret: requireEnv("META_APP_SECRET"),
    redirect_uri: requireEnv("META_REDIRECT_URI"),
    code,
  });
  return data.access_token;
}

export async function exchangeForLongLivedToken(shortLivedToken: string): Promise<string> {
  const data = await graphGet<{ access_token: string }>("/oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: requireEnv("META_APP_ID"),
    client_secret: requireEnv("META_APP_SECRET"),
    fb_exchange_token: shortLivedToken,
  });
  return data.access_token;
}

interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string };
}

interface FacebookPagesResponse {
  data: FacebookPage[];
  paging?: { next?: string };
}

async function getAllPages(longLivedUserToken: string): Promise<FacebookPage[]> {
  const pages: FacebookPage[] = [];
  let nextUrl: string | null = null;

  do {
    const data: FacebookPagesResponse = nextUrl
      ? await (await fetch(nextUrl)).json()
      : await graphGet<FacebookPagesResponse>("/me/accounts", {
          fields: "name,access_token,instagram_business_account",
          limit: "100",
          access_token: longLivedUserToken,
        });

    pages.push(...data.data);
    nextUrl = data.paging?.next ?? null;
  } while (nextUrl);

  return pages;
}

export async function findInstagramAccounts(
  longLivedUserToken: string
): Promise<{ pageId: string; pageName: string; igUserId: string; pageAccessToken: string }[]> {
  const pages = await getAllPages(longLivedUserToken);

  return pages
    .filter((page) => page.instagram_business_account)
    .map((page) => ({
      pageId: page.id,
      pageName: page.name,
      igUserId: page.instagram_business_account!.id,
      pageAccessToken: page.access_token,
    }));
}

export async function getInstagramUsername(igUserId: string, pageAccessToken: string): Promise<string | null> {
  const data = await graphGet<{ username?: string }>(`/${igUserId}`, {
    fields: "username",
    access_token: pageAccessToken,
  });
  return data.username ?? null;
}

interface InstagramMedia {
  id: string;
  caption?: string;
  like_count?: number;
  comments_count?: number;
  timestamp: string;
  permalink: string;
  media_type: string;
}

export async function getTopMedia(igUserId: string, pageAccessToken: string, limit = 25) {
  const data = await graphGet<{ data: InstagramMedia[] }>(`/${igUserId}/media`, {
    fields: "caption,like_count,comments_count,timestamp,permalink,media_type",
    limit: String(limit),
    access_token: pageAccessToken,
  });

  return data.data
    .map((media) => ({ ...media, engagement: (media.like_count ?? 0) + (media.comments_count ?? 0) }))
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, 5);
}

export async function getProfileMetrics(igUserId: string, pageAccessToken: string) {
  const data = await graphGet<{ followers_count?: number; media_count?: number }>(`/${igUserId}`, {
    fields: "followers_count,media_count",
    access_token: pageAccessToken,
  });
  return data;
}

// Totais de conta pra um período (usa metric_type=total_value, que soma o intervalo inteiro).
export async function getAccountTotals(
  igUserId: string,
  pageAccessToken: string,
  sinceUnix: number,
  untilUnix: number
): Promise<{ reach: number; profileViews: number }> {
  try {
    const data = await graphGet<{ data: { name: string; total_value?: { value: number } }[] }>(
      `/${igUserId}/insights`,
      {
        metric: "reach,profile_views",
        period: "day",
        metric_type: "total_value",
        since: String(sinceUnix),
        until: String(untilUnix),
        access_token: pageAccessToken,
      }
    );
    const byName = Object.fromEntries(data.data.map((m) => [m.name, m.total_value?.value ?? 0]));
    return { reach: byName.reach ?? 0, profileViews: byName.profile_views ?? 0 };
  } catch {
    return { reach: 0, profileViews: 0 };
  }
}

// Série diária de alcance (pro gráfico), diferente do getAccountTotals que soma tudo num único número.
export async function getDailyReach(
  igUserId: string,
  pageAccessToken: string,
  sinceUnix: number,
  untilUnix: number
): Promise<{ date: string; value: number }[]> {
  try {
    const data = await graphGet<{ data: { name: string; values: { end_time: string; value: number }[] }[] }>(
      `/${igUserId}/insights`,
      {
        metric: "reach",
        period: "day",
        since: String(sinceUnix),
        until: String(untilUnix),
        access_token: pageAccessToken,
      }
    );
    const reachMetric = data.data.find((m) => m.name === "reach");
    return (reachMetric?.values ?? []).map((v) => ({ date: v.end_time.slice(0, 10), value: v.value }));
  } catch {
    return [];
  }
}

export interface PeriodMedia {
  id: string;
  caption?: string;
  media_type: string;
  timestamp: string;
  permalink: string;
  like_count: number;
  comments_count: number;
  reach: number | null;
  saved: number | null;
  shares: number | null;
}

export async function getMediaInPeriod(
  igUserId: string,
  pageAccessToken: string,
  sinceUnix: number,
  untilUnix: number
): Promise<PeriodMedia[]> {
  const data = await graphGet<{ data: InstagramMedia[] }>(`/${igUserId}/media`, {
    fields: "caption,like_count,comments_count,timestamp,permalink,media_type",
    since: String(sinceUnix),
    until: String(untilUnix),
    limit: "100",
    access_token: pageAccessToken,
  });

  return Promise.all(
    data.data.map(async (media) => {
      const insights = await getMediaInsightsSafely(media.id, pageAccessToken);
      return {
        id: media.id,
        caption: media.caption,
        media_type: media.media_type,
        timestamp: media.timestamp,
        permalink: media.permalink,
        like_count: media.like_count ?? 0,
        comments_count: media.comments_count ?? 0,
        reach: insights.reach,
        saved: insights.saved,
        shares: insights.shares,
      };
    })
  );
}

export interface ScheduledFacebookPost {
  id: string;
  message?: string;
  scheduledPublishTime: string;
  createdTime: string;
}

// Espelha os posts que já estão agendados de verdade na Página do Facebook
// (agendados direto no Meta Business Suite ou por qualquer outra ferramenta) — somente leitura.
export async function getScheduledFacebookPosts(pageId: string, pageAccessToken: string): Promise<ScheduledFacebookPost[]> {
  const data = await graphGet<{
    data: { id: string; message?: string; scheduled_publish_time?: number; created_time: string }[];
  }>(`/${pageId}/scheduled_posts`, {
    fields: "message,scheduled_publish_time,created_time",
    limit: "100",
    access_token: pageAccessToken,
  });

  return data.data
    .filter((post) => post.scheduled_publish_time)
    .map((post) => ({
      id: post.id,
      message: post.message,
      scheduledPublishTime: new Date(post.scheduled_publish_time! * 1000).toISOString(),
      createdTime: post.created_time,
    }))
    .sort((a, b) => a.scheduledPublishTime.localeCompare(b.scheduledPublishTime));
}

// Tenta um conjunto de métricas mais completo primeiro; se a conta/tipo de mídia
// não suportar alguma delas, cai pra um conjunto menor em vez de falhar tudo.
async function getMediaInsightsSafely(
  mediaId: string,
  pageAccessToken: string
): Promise<{ reach: number | null; saved: number | null; shares: number | null }> {
  const attempts = ["reach,saved,shares", "reach,saved", "reach"];
  for (const metric of attempts) {
    try {
      const data = await graphGet<{ data: { name: string; values: { value: number }[] }[] }>(
        `/${mediaId}/insights`,
        { metric, access_token: pageAccessToken }
      );
      const byName = Object.fromEntries(data.data.map((m) => [m.name, m.values?.[0]?.value ?? 0]));
      return { reach: byName.reach ?? null, saved: byName.saved ?? null, shares: byName.shares ?? null };
    } catch {
      continue;
    }
  }
  return { reach: null, saved: null, shares: null };
}
