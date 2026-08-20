import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { DashboardReportData } from "@/lib/reportData";
import { MEDIA_TYPE_LABEL, pctChange } from "@/lib/reportData";

const COLOR_INK = "#1c2620";
const COLOR_MUTED = "#6b7570";
const COLOR_ACCENT = "#3f6b4f";
const COLOR_LINE = "#e2e6e3";
const COLOR_BG = "#f4f6f4";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, color: COLOR_INK, fontFamily: "Helvetica" },
  h1: { fontSize: 20, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  h2: { fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 18, marginBottom: 8, color: COLOR_ACCENT },
  h3: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 12, marginBottom: 6 },
  muted: { color: COLOR_MUTED, fontSize: 9 },
  cardsRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  card: { flex: 1, backgroundColor: COLOR_BG, borderRadius: 4, padding: 10 },
  cardLabel: { fontSize: 8, color: COLOR_MUTED, textTransform: "uppercase" },
  cardValue: { fontSize: 16, fontFamily: "Helvetica-Bold", marginTop: 4 },
  cardDeltaPos: { fontSize: 8, color: COLOR_ACCENT, marginTop: 2 },
  cardDeltaNeg: { fontSize: 8, color: "#b23b3b", marginTop: 2 },
  table: { marginTop: 6, borderWidth: 1, borderColor: COLOR_LINE, borderRadius: 3 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: COLOR_LINE },
  trHead: { flexDirection: "row", backgroundColor: COLOR_BG, borderBottomWidth: 1, borderBottomColor: COLOR_LINE },
  th: { padding: 5, fontSize: 8, fontFamily: "Helvetica-Bold", flex: 1 },
  td: { padding: 5, fontSize: 8, flex: 1 },
  footer: { position: "absolute", bottom: 20, left: 32, right: 32, fontSize: 8, color: COLOR_MUTED, textAlign: "center" },
});

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("pt-BR");
}

function MetricCard({ label, value, delta }: { label: string; value: string; delta?: number | null }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardValue}>{value}</Text>
      {delta != null && (
        <Text style={delta >= 0 ? styles.cardDeltaPos : styles.cardDeltaNeg}>
          {delta >= 0 ? "+" : ""}
          {delta.toFixed(1)}% vs período anterior
        </Text>
      )}
    </View>
  );
}

export function DashboardReportDocument({ data }: { data: DashboardReportData }) {
  const {
    client,
    igUsername,
    pageId,
    pageName,
    rangeLabel,
    totals,
    prevTotals,
    followers,
    media,
    storyInsights,
    pageFollowers,
    pageTotals,
    prevPageTotals,
    pagePosts,
    insights,
  } = data;

  const reachDelta = pctChange(totals.reach, prevTotals.reach);
  const profileViewsDelta = pctChange(totals.profileViews, prevTotals.profileViews);

  const topPosts = [...media].sort((a, b) => (b.reach ?? 0) - (a.reach ?? 0)).slice(0, 8);
  const topReels = [...media]
    .filter((m) => m.media_type === "REELS")
    .sort((a, b) => (b.reach ?? 0) - (a.reach ?? 0))
    .slice(0, 5);

  const sumBy = (arr: typeof storyInsights, pick: (s: (typeof storyInsights)[number]) => number | null | undefined) =>
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
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.h1}>Relatório de {client.name}</Text>
        <Text style={styles.muted}>Análise de desempenho</Text>
        <Text style={{ ...styles.muted, marginTop: 4 }}>
          Dados analisados entre {rangeLabel} (@{igUsername}
          {pageName ? ` · ${pageName}` : ""})
        </Text>

        <Text style={styles.h2}>Dados gerais do perfil</Text>
        <View style={styles.cardsRow}>
          <MetricCard label="Seguidores atuais" value={fmt(followers)} />
          <MetricCard label="Alcance no período" value={fmt(totals.reach)} delta={reachDelta} />
          <MetricCard label="Visitas ao perfil" value={fmt(totals.profileViews)} delta={profileViewsDelta} />
        </View>

        {insights.length > 0 && (
          <>
            <Text style={styles.h3}>Insights do período</Text>
            {insights.map((line, i) => (
              <Text key={i} style={{ fontSize: 9, marginBottom: 3 }}>
                • {line}
              </Text>
            ))}
          </>
        )}

        <Text style={styles.h3}>Postagens em destaque ({media.length} no total)</Text>
        <View style={styles.table}>
          <View style={styles.trHead}>
            <Text style={{ ...styles.th, flex: 2.5 }}>Postagem</Text>
            <Text style={styles.th}>Tipo</Text>
            <Text style={styles.th}>Alcance</Text>
            <Text style={styles.th}>Curtidas</Text>
            <Text style={styles.th}>Coment.</Text>
            <Text style={styles.th}>Salvos</Text>
          </View>
          {topPosts.length === 0 && (
            <View style={styles.tr}>
              <Text style={{ ...styles.td, flex: 1 }}>Nenhuma postagem no período.</Text>
            </View>
          )}
          {topPosts.map((m) => (
            <View key={m.id} style={styles.tr}>
              <Text style={{ ...styles.td, flex: 2.5 }}>{(m.caption ?? "(sem legenda)").slice(0, 50)}</Text>
              <Text style={styles.td}>{MEDIA_TYPE_LABEL[m.media_type] ?? m.media_type}</Text>
              <Text style={styles.td}>{fmt(m.reach)}</Text>
              <Text style={styles.td}>{fmt(m.like_count)}</Text>
              <Text style={styles.td}>{fmt(m.comments_count)}</Text>
              <Text style={styles.td}>{fmt(m.saved)}</Text>
            </View>
          ))}
        </View>

        {topReels.length > 0 && (
          <>
            <Text style={styles.h3}>Reels em destaque</Text>
            <View style={styles.table}>
              <View style={styles.trHead}>
                <Text style={{ ...styles.th, flex: 2.5 }}>Reel</Text>
                <Text style={styles.th}>Alcance</Text>
                <Text style={styles.th}>Curtidas</Text>
                <Text style={styles.th}>Coment.</Text>
                <Text style={styles.th}>Compart.</Text>
              </View>
              {topReels.map((m) => (
                <View key={m.id} style={styles.tr}>
                  <Text style={{ ...styles.td, flex: 2.5 }}>{(m.caption ?? "(sem legenda)").slice(0, 50)}</Text>
                  <Text style={styles.td}>{fmt(m.reach)}</Text>
                  <Text style={styles.td}>{fmt(m.like_count)}</Text>
                  <Text style={styles.td}>{fmt(m.comments_count)}</Text>
                  <Text style={styles.td}>{fmt(m.shares)}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <Text style={styles.footer} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.h2}>Dados de Stories</Text>
        <Text style={styles.muted}>
          A API do Meta só expõe Stories ativos (últimas 24h) — este histórico vem de uma captura diária feita pela
          própria ferramenta, então só existem dados a partir do dia em que a conexão foi feita.
        </Text>
        <View style={styles.cardsRow}>
          <MetricCard label="Stories no período" value={fmt(storyInsights.length)} />
          <MetricCard label="Total de respostas" value={fmt(sumBy(storyInsights, (s) => s.replies))} />
          <MetricCard label="Total de interações" value={fmt(sumBy(storyInsights, (s) => s.interactions))} />
        </View>

        {storyInsights.length > 0 && (
          <View style={styles.table}>
            <View style={styles.trHead}>
              <Text style={styles.th}>Data</Text>
              <Text style={styles.th}>Visualiz.</Text>
              <Text style={styles.th}>Alcance</Text>
              <Text style={styles.th}>Interações</Text>
              <Text style={styles.th}>Respostas</Text>
              <Text style={styles.th}>Avançar</Text>
              <Text style={styles.th}>Voltar</Text>
              <Text style={styles.th}>Saiu</Text>
            </View>
            {storyInsights.map((s) => (
              <View key={s.id} style={styles.tr}>
                <Text style={styles.td}>{s.timestamp.toLocaleDateString("pt-BR")}</Text>
                <Text style={styles.td}>{fmt(s.impressions)}</Text>
                <Text style={styles.td}>{fmt(s.reach)}</Text>
                <Text style={styles.td}>{fmt(s.interactions)}</Text>
                <Text style={styles.td}>{fmt(s.replies)}</Text>
                <Text style={styles.td}>{fmt(s.tapsForward)}</Text>
                <Text style={styles.td}>{fmt(s.tapsBack)}</Text>
                <Text style={styles.td}>{fmt(s.exits)}</Text>
              </View>
            ))}
          </View>
        )}

        {pageId && (
          <>
            <Text style={styles.h2}>Dados gerais da página (Facebook)</Text>
            <View style={styles.cardsRow}>
              <MetricCard label="Seguidores da página" value={fmt(pageFollowers)} />
              <MetricCard
                label="Visualizadores"
                value={fmt(pageTotals?.impressions)}
                delta={pageTotals && prevPageTotals ? pctChange(pageTotals.impressions, prevPageTotals.impressions) : null}
              />
              <MetricCard
                label="Novos seguidores"
                value={fmt(pageTotals?.newFollowers)}
                delta={pageTotals && prevPageTotals ? pctChange(pageTotals.newFollowers, prevPageTotals.newFollowers) : null}
              />
              <MetricCard
                label="Engajamento"
                value={fmt(pageTotals?.engagements)}
                delta={pageTotals && prevPageTotals ? pctChange(pageTotals.engagements, prevPageTotals.engagements) : null}
              />
            </View>

            <Text style={styles.h3}>Performance por tipo de postagem</Text>
            <View style={styles.table}>
              <View style={styles.trHead}>
                <Text style={styles.th}>Tipo</Text>
                <Text style={styles.th}>Postagens</Text>
                <Text style={styles.th}>Visualizadores</Text>
                <Text style={styles.th}>Reações</Text>
              </View>
              {Object.keys(postsByType).length === 0 && (
                <View style={styles.tr}>
                  <Text style={{ ...styles.td, flex: 1 }}>Nenhuma postagem no Facebook neste período.</Text>
                </View>
              )}
              {Object.entries(postsByType).map(([type, d]) => (
                <View key={type} style={styles.tr}>
                  <Text style={styles.td}>{type}</Text>
                  <Text style={styles.td}>{d.count}</Text>
                  <Text style={styles.td}>{fmt(d.impressions)}</Text>
                  <Text style={styles.td}>{fmt(d.reactions)}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.h3}>Postagens em destaque (Facebook)</Text>
            <View style={styles.table}>
              <View style={styles.trHead}>
                <Text style={{ ...styles.th, flex: 2.5 }}>Postagem</Text>
                <Text style={styles.th}>Tipo</Text>
                <Text style={styles.th}>Visualiz.</Text>
                <Text style={styles.th}>Reações</Text>
                <Text style={styles.th}>Coment.</Text>
              </View>
              {topPagePosts.length === 0 && (
                <View style={styles.tr}>
                  <Text style={{ ...styles.td, flex: 1 }}>Nenhuma postagem no Facebook neste período.</Text>
                </View>
              )}
              {topPagePosts.map((post) => (
                <View key={post.id} style={styles.tr}>
                  <Text style={{ ...styles.td, flex: 2.5 }}>{(post.message ?? "(sem legenda)").slice(0, 50)}</Text>
                  <Text style={styles.td}>{post.postType}</Text>
                  <Text style={styles.td}>{fmt(post.impressions)}</Text>
                  <Text style={styles.td}>{post.reactions}</Text>
                  <Text style={styles.td}>{post.comments}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <Text style={styles.footer} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}
