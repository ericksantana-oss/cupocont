import { graphGet } from "@/lib/meta/graph";

// A API do Meta recusa janela maior que 30 dias com erro (#100). Um mês de 31 dias
// estoura o limite — e como as funções antigas engoliam o erro e devolviam zero, o
// dashboard mostrava 0 de alcance em qualquer mês de 31 dias sem avisar ninguém.
const MAX_DIAS_JANELA = 30;

export type Janela = { since: number; until: number };

export function dividirJanela({ since, until }: Janela, maxDias = MAX_DIAS_JANELA): Janela[] {
  const maxSegundos = maxDias * 86400;
  const pedacos: Janela[] = [];
  let inicio = since;

  while (inicio < until) {
    const fim = Math.min(inicio + maxSegundos, until);
    pedacos.push({ since: inicio, until: fim });
    inicio = fim + 1;
  }

  return pedacos.length > 0 ? pedacos : [{ since, until }];
}

type SerieDiaria = { date: string; value: number };

async function somaTotalValue(
  igUserId: string,
  token: string,
  metric: string,
  janela: Janela
): Promise<number | null> {
  let total = 0;
  let algumRespondeu = false;

  for (const pedaco of dividirJanela(janela)) {
    try {
      const data = await graphGet<{ data: { name: string; total_value?: { value: number } }[] }>(
        `/${igUserId}/insights`,
        {
          metric,
          period: "day",
          metric_type: "total_value",
          since: String(pedaco.since),
          until: String(pedaco.until),
          access_token: token,
        }
      );
      const valor = data.data.find((m) => m.name === metric)?.total_value?.value;
      if (valor != null) {
        total += valor;
        algumRespondeu = true;
      }
    } catch {
      // Uma métrica indisponível não pode derrubar o resto do relatório.
    }
  }

  return algumRespondeu ? total : null;
}

async function serieDiaria(
  igUserId: string,
  token: string,
  metric: string,
  janela: Janela
): Promise<SerieDiaria[]> {
  const pontos: SerieDiaria[] = [];

  for (const pedaco of dividirJanela(janela)) {
    try {
      const data = await graphGet<{ data: { name: string; values: { end_time: string; value: number }[] }[] }>(
        `/${igUserId}/insights`,
        {
          metric,
          period: "day",
          since: String(pedaco.since),
          until: String(pedaco.until),
          access_token: token,
        }
      );
      const serie = data.data.find((m) => m.name === metric)?.values ?? [];
      pontos.push(...serie.map((v) => ({ date: v.end_time.slice(0, 10), value: v.value })));
    } catch {
      // idem
    }
  }

  // Pedaços vizinhos podem repetir a data de fronteira.
  const porData = new Map(pontos.map((p) => [p.date, p]));
  return [...porData.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export type MetricasInstagram = {
  followers: number | null;
  mediaCount: number | null;
  /** Soma do alcance único diário — é o número que o Reportei mostra. */
  alcanceSomaDiaria: number | null;
  /** Alcance deduplicado no período: quem apareceu em dois dias conta uma vez. */
  alcanceUnicoPeriodo: number | null;
  /**
   * Total de visualizacoes da conta. NAO e igual as "Visualizacoes Organicas" do
   * Reportei: aquele numero exclui conteudo impulsionado, e a API nao oferece a
   * separacao organico/pago no nivel da conta (testado em 26/08/2026).
   */
  visualizacoes: number | null;
  visitasPerfil: number | null;
  contasEngajadas: number | null;
  interacoesTotais: number | null;
  cliquesNoSite: number | null;
  serieAlcance: SerieDiaria[];
  serieVisualizacoes: SerieDiaria[];
};

export async function getInstagramMetrics(
  igUserId: string,
  token: string,
  janela: Janela
): Promise<MetricasInstagram> {
  const [perfil, serieAlcance, serieVisualizacoes, alcanceUnico, visualizacoes, visitas, engajadas, interacoes, cliques] =
    await Promise.all([
      graphGet<{ followers_count?: number; media_count?: number }>(`/${igUserId}`, {
        fields: "followers_count,media_count",
        access_token: token,
      }).catch(() => ({}) as { followers_count?: number; media_count?: number }),
      serieDiaria(igUserId, token, "reach", janela),
      serieDiaria(igUserId, token, "views", janela),
      somaTotalValue(igUserId, token, "reach", janela),
      somaTotalValue(igUserId, token, "views", janela),
      somaTotalValue(igUserId, token, "profile_views", janela),
      somaTotalValue(igUserId, token, "accounts_engaged", janela),
      somaTotalValue(igUserId, token, "total_interactions", janela),
      somaTotalValue(igUserId, token, "website_clicks", janela),
    ]);

  const somaDiaria = serieAlcance.length > 0 ? serieAlcance.reduce((s, p) => s + p.value, 0) : null;

  return {
    followers: perfil.followers_count ?? null,
    mediaCount: perfil.media_count ?? null,
    alcanceSomaDiaria: somaDiaria,
    alcanceUnicoPeriodo: alcanceUnico,
    visualizacoes,
    visitasPerfil: visitas,
    contasEngajadas: engajadas,
    interacoesTotais: interacoes,
    cliquesNoSite: cliques,
    serieAlcance,
    serieVisualizacoes,
  };
}

export type PostInstagram = {
  id: string;
  caption: string | null;
  mediaType: string;
  timestamp: string;
  permalink: string;
  alcance: number | null;
  visualizacoes: number | null;
  curtidas: number;
  comentarios: number;
  salvos: number | null;
  compartilhamentos: number | null;
  interacoes: number | null;
  novosSeguidores: number | null;
  visitasPerfil: number | null;
};

// Métricas por post, uma consulta de insights por post. A "impressions" morreu na
// v22 da API — "views" é a substituta.
const METRICAS_POST = [
  "reach",
  "views",
  "likes",
  "comments",
  "saved",
  "shares",
  "total_interactions",
  "follows",
  "profile_visits",
] as const;

export async function getInstagramPosts(
  igUserId: string,
  token: string,
  janela: Janela
): Promise<PostInstagram[]> {
  const lista = await graphGet<{
    data: { id: string; caption?: string; media_type: string; timestamp: string; permalink: string; like_count?: number; comments_count?: number }[];
  }>(`/${igUserId}/media`, {
    fields: "caption,media_type,timestamp,permalink,like_count,comments_count",
    since: String(janela.since),
    until: String(janela.until),
    limit: "100",
    access_token: token,
  }).catch(() => ({ data: [] }));

  return Promise.all(
    lista.data.map(async (m) => {
      const insights = await graphGet<{ data: { name: string; values: { value: number }[] }[] }>(
        `/${m.id}/insights`,
        { metric: METRICAS_POST.join(","), access_token: token }
      ).catch(() => ({ data: [] as { name: string; values: { value: number }[] }[] }));

      const v = (nome: string): number | null =>
        insights.data.find((x) => x.name === nome)?.values?.[0]?.value ?? null;

      return {
        id: m.id,
        caption: m.caption ?? null,
        mediaType: m.media_type,
        timestamp: m.timestamp,
        permalink: m.permalink,
        alcance: v("reach"),
        visualizacoes: v("views"),
        curtidas: m.like_count ?? v("likes") ?? 0,
        comentarios: m.comments_count ?? v("comments") ?? 0,
        salvos: v("saved"),
        compartilhamentos: v("shares"),
        interacoes: v("total_interactions"),
        novosSeguidores: v("follows"),
        visitasPerfil: v("profile_visits"),
      };
    })
  );
}

export type MetricasFacebook = {
  seguidores: number | null;
  /** false quando o token não tem read_insights: a API devolve lista vazia em vez de erro. */
  temPermissaoInsights: boolean;
  visualizacoesPagina: number | null;
  engajamentoPosts: number | null;
  novosSeguidores: number | null;
};

// O Meta responde 200 com "data": [] quando falta read_insights, em vez de negar.
// Sem distinguir isso de "não houve atividade", a tela mentiria: mostraria zero
// como se fosse resultado medido.
export async function getFacebookMetrics(
  pageId: string,
  token: string,
  janela: Janela
): Promise<MetricasFacebook> {
  const perfil = await graphGet<{ followers_count?: number; fan_count?: number }>(`/${pageId}`, {
    fields: "followers_count,fan_count",
    access_token: token,
  }).catch(() => ({}) as { followers_count?: number; fan_count?: number });

  async function metrica(nome: string): Promise<number | null> {
    let total = 0;
    let houveValor = false;

    for (const pedaco of dividirJanela(janela)) {
      try {
        const data = await graphGet<{ data: { name: string; values: { value: number }[] }[] }>(
          `/${pageId}/insights`,
          {
            metric: nome,
            period: "day",
            since: String(pedaco.since),
            until: String(pedaco.until),
            access_token: token,
          }
        );
        const valores = data.data.find((m) => m.name === nome)?.values ?? [];
        for (const v of valores) {
          if (typeof v.value === "number") {
            total += v.value;
            houveValor = true;
          }
        }
      } catch {
        // idem
      }
    }

    return houveValor ? total : null;
  }

  const [visualizacoes, engajamento, novos] = await Promise.all([
    metrica("page_views_total"),
    metrica("page_post_engagements"),
    metrica("page_daily_follows_unique"),
  ]);

  return {
    seguidores: perfil.followers_count ?? perfil.fan_count ?? null,
    temPermissaoInsights: visualizacoes != null || engajamento != null || novos != null,
    visualizacoesPagina: visualizacoes,
    engajamentoPosts: engajamento,
    novosSeguidores: novos,
  };
}
