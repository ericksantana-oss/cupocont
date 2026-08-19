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
    scope: "pages_show_list,pages_read_engagement,instagram_basic,instagram_manage_insights",
  });

  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}

async function graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${GRAPH_URL}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const res = await fetch(url.toString());
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? "Erro ao consultar a API do Meta.");
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

export async function findInstagramAccounts(
  longLivedUserToken: string
): Promise<{ pageName: string; igUserId: string; pageAccessToken: string }[]> {
  const data = await graphGet<{ data: FacebookPage[] }>("/me/accounts", {
    fields: "name,access_token,instagram_business_account",
    access_token: longLivedUserToken,
  });

  return data.data
    .filter((page) => page.instagram_business_account)
    .map((page) => ({
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
