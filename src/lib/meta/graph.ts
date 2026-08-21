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
      "pages_show_list,pages_read_engagement,pages_read_user_content,pages_manage_posts,instagram_basic,instagram_manage_insights,instagram_content_publish,business_management",
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

// Diagnóstico: o Meta guarda agendamentos em mais de um lugar dependendo de como
// o post foi criado (API, Creator Studio, Business Suite). Consulta cada caminho
// possível e devolve o que cada um responde, pra descobrir onde o post realmente está.
export async function probeScheduledFacebookPosts(
  pageId: string,
  pageAccessToken: string
): Promise<{ endpoint: string; resultado: string }[]> {
  const tentativas: { endpoint: string; params: Record<string, string> }[] = [
    { endpoint: `/${pageId}/scheduled_posts`, params: { fields: "message,scheduled_publish_time,created_time,is_published" } },
    { endpoint: `/${pageId}/feed`, params: { fields: "message,scheduled_publish_time,created_time,is_published", is_published: "false" } },
    { endpoint: `/${pageId}/posts`, params: { fields: "message,scheduled_publish_time,created_time,is_published", is_published: "false" } },
    { endpoint: `/${pageId}/video_reels`, params: { fields: "scheduled_publish_time,created_time,post_views", is_published: "false" } },
  ];

  return Promise.all(
    tentativas.map(async ({ endpoint, params }) => {
      try {
        const data = await graphGet<{ data?: unknown[] }>(endpoint, {
          ...params,
          limit: "50",
          access_token: pageAccessToken,
        });
        const itens = data.data ?? [];
        return {
          endpoint,
          resultado: `${itens.length} item(ns)\n${JSON.stringify(itens, null, 2)}`,
        };
      } catch (err) {
        return { endpoint, resultado: `ERRO: ${err instanceof Error ? err.message : "desconhecido"}` };
      }
    })
  );
}

// Espelha os posts que já estão agendados de verdade na Página do Facebook
// (agendados direto no Meta Business Suite ou por qualquer outra ferramenta) — somente leitura.
//
// O endpoint devolve também agendamentos antigos que nunca foram publicados e ficaram presos
// na Página (já vimos casos de 2017). Só interessa o que ainda está por vir, então descartamos
// qualquer data no passado — isso mantém a lista limpa e evita que o alerta de cobertura
// calcule "agendado até" a partir de uma data que já passou.
export async function getScheduledFacebookPosts(pageId: string, pageAccessToken: string): Promise<ScheduledFacebookPost[]> {
  const data = await graphGet<{
    data: { id: string; message?: string; scheduled_publish_time?: number; created_time: string }[];
  }>(`/${pageId}/scheduled_posts`, {
    fields: "message,scheduled_publish_time,created_time",
    limit: "100",
    access_token: pageAccessToken,
  });

  const nowUnix = Math.floor(Date.now() / 1000);

  return data.data
    .filter((post) => post.scheduled_publish_time && post.scheduled_publish_time > nowUnix)
    .map((post) => ({
      id: post.id,
      message: post.message,
      scheduledPublishTime: new Date(post.scheduled_publish_time! * 1000).toISOString(),
      createdTime: post.created_time,
    }))
    .sort((a, b) => a.scheduledPublishTime.localeCompare(b.scheduledPublishTime));
}

export interface ActiveStoryInsight {
  mediaId: string;
  timestamp: string;
  impressions: number | null;
  reach: number | null;
  interactions: number | null;
  replies: number | null;
  shares: number | null;
  tapsForward: number | null;
  tapsBack: number | null;
  exits: number | null;
  profileVisits: number | null;
}

// Só existem Stories ativos (< 24h) nesse endpoint — assim que expiram, o Meta não expõe mais o dado.
// Por isso é preciso rodar isso periodicamente (via cron) e guardar o resultado, pra ter histórico depois.
export async function getActiveStoriesInsights(igUserId: string, pageAccessToken: string): Promise<ActiveStoryInsight[]> {
  const stories = await graphGet<{ data: { id: string; timestamp: string }[] }>(`/${igUserId}/stories`, {
    fields: "id,timestamp",
    access_token: pageAccessToken,
  });

  return Promise.all(
    stories.data.map(async (story) => {
      const insights = await getStoryInsightsSafely(story.id, pageAccessToken);
      return { mediaId: story.id, timestamp: story.timestamp, ...insights };
    })
  );
}

async function getStoryInsightsSafely(
  mediaId: string,
  pageAccessToken: string
): Promise<Omit<ActiveStoryInsight, "mediaId" | "timestamp">> {
  const attempts = [
    "impressions,reach,interactions,replies,shares,taps_forward,taps_back,exits,profile_visits",
    "impressions,reach,replies,exits",
    "impressions,reach",
  ];
  for (const metric of attempts) {
    try {
      const data = await graphGet<{ data: { name: string; values: { value: number }[] }[] }>(`/${mediaId}/insights`, {
        metric,
        access_token: pageAccessToken,
      });
      const byName = Object.fromEntries(data.data.map((m) => [m.name, m.values?.[0]?.value ?? 0]));
      return {
        impressions: byName.impressions ?? null,
        reach: byName.reach ?? null,
        interactions: byName.interactions ?? null,
        replies: byName.replies ?? null,
        shares: byName.shares ?? null,
        tapsForward: byName.taps_forward ?? null,
        tapsBack: byName.taps_back ?? null,
        exits: byName.exits ?? null,
        profileVisits: byName.profile_visits ?? null,
      };
    } catch {
      continue;
    }
  }
  return {
    impressions: null,
    reach: null,
    interactions: null,
    replies: null,
    shares: null,
    tapsForward: null,
    tapsBack: null,
    exits: null,
    profileVisits: null,
  };
}

export async function getPageFollowers(pageId: string, pageAccessToken: string): Promise<number | null> {
  try {
    const data = await graphGet<{ followers_count?: number }>(`/${pageId}`, {
      fields: "followers_count",
      access_token: pageAccessToken,
    });
    return data.followers_count ?? null;
  } catch {
    return null;
  }
}

// Totais da Página do Facebook pra um período — reach/visualizações, novos seguidores e engajamento.
export async function getPageTotals(
  pageId: string,
  pageAccessToken: string,
  sinceUnix: number,
  untilUnix: number
): Promise<{ impressions: number; newFollowers: number; engagements: number }> {
  try {
    const data = await graphGet<{ data: { name: string; total_value?: { value: number } }[] }>(`/${pageId}/insights`, {
      metric: "page_impressions_unique,page_fan_adds,page_post_engagements",
      period: "day",
      metric_type: "total_value",
      since: String(sinceUnix),
      until: String(untilUnix),
      access_token: pageAccessToken,
    });
    const byName = Object.fromEntries(data.data.map((m) => [m.name, m.total_value?.value ?? 0]));
    return {
      impressions: byName.page_impressions_unique ?? 0,
      newFollowers: byName.page_fan_adds ?? 0,
      engagements: byName.page_post_engagements ?? 0,
    };
  } catch {
    return { impressions: 0, newFollowers: 0, engagements: 0 };
  }
}

export interface PagePost {
  id: string;
  message?: string;
  createdTime: string;
  postType: "Reel" | "Álbum" | "Foto" | "Vídeo" | "Link" | "Status";
  permalink?: string;
  impressions: number | null;
  reactions: number;
  comments: number;
  shares: number;
}

async function getPagePostImpressions(postId: string, pageAccessToken: string): Promise<number | null> {
  try {
    const data = await graphGet<{ data: { name: string; values: { value: number }[] }[] }>(`/${postId}/insights`, {
      metric: "post_impressions_unique",
      access_token: pageAccessToken,
    });
    return data.data[0]?.values?.[0]?.value ?? null;
  } catch {
    return null;
  }
}

function classifyPageAttachment(type: string | undefined): PagePost["postType"] {
  switch (type) {
    case "video_inline":
    case "video_autoplay":
    case "video_direct_response":
      return "Vídeo";
    case "album":
      return "Álbum";
    case "photo":
      return "Foto";
    case "share":
      return "Link";
    default:
      return "Status";
  }
}

export async function getPagePostsInPeriod(
  pageId: string,
  pageAccessToken: string,
  sinceUnix: number,
  untilUnix: number
): Promise<PagePost[]> {
  try {
    const data = await graphGet<{
      data: {
        id: string;
        message?: string;
        created_time: string;
        permalink_url?: string;
        attachments?: { data: { media_type?: string; type?: string }[] };
        reactions?: { summary?: { total_count?: number } };
        comments?: { summary?: { total_count?: number } };
        shares?: { count?: number };
      }[];
    }>(`/${pageId}/posts`, {
      fields:
        "message,created_time,permalink_url,attachments{media_type,type},reactions.summary(true),comments.summary(true),shares",
      since: String(sinceUnix),
      until: String(untilUnix),
      limit: "100",
      access_token: pageAccessToken,
    });

    return await Promise.all(
      data.data.map(async (post) => {
        const attachmentType = post.attachments?.data?.[0]?.type;
        const mediaType = post.attachments?.data?.[0]?.media_type;
        const isReel = attachmentType === "video_inline" && mediaType === "video";

        return {
          id: post.id,
          message: post.message,
          createdTime: post.created_time,
          permalink: post.permalink_url,
          postType: isReel ? "Reel" : classifyPageAttachment(attachmentType),
          impressions: await getPagePostImpressions(post.id, pageAccessToken),
          reactions: post.reactions?.summary?.total_count ?? 0,
          comments: post.comments?.summary?.total_count ?? 0,
          shares: post.shares?.count ?? 0,
        };
      })
    );
  } catch {
    // Falta de permissão (ex: pages_read_user_content antes de reconectar) não pode derrubar o dashboard inteiro.
    return [];
  }
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
