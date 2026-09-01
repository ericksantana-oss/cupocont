import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { DashboardReportData } from "@/lib/reportData";
import { MEDIA_TYPE_LABEL, pctChange } from "@/lib/reportData";

const TINTA = "#1c2620";
const SUAVE = "#6b7570";
const VERDE = "#3f6b4f";
const LINHA = "#e2e6e3";
const FUNDO = "#f4f6f4";
const VERMELHO = "#b23b3b";

const s = StyleSheet.create({
  page: { padding: 30, fontSize: 9, color: TINTA, fontFamily: "Helvetica" },
  h1: { fontSize: 19, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  rede: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: VERDE,
    marginTop: 16,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1.5,
    borderBottomColor: VERDE,
  },
  h3: { fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 12, marginBottom: 5 },
  suave: { color: SUAVE, fontSize: 8 },
  linhaCartoes: { flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" },
  cartao: { backgroundColor: FUNDO, borderRadius: 3, padding: 8, width: "23.5%" },
  cartaoRotulo: { fontSize: 6.5, color: SUAVE, textTransform: "uppercase" },
  cartaoValor: { fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 3 },
  deltaPos: { fontSize: 6.5, color: VERDE, marginTop: 2 },
  deltaNeg: { fontSize: 6.5, color: VERMELHO, marginTop: 2 },
  tabela: { marginTop: 5, borderWidth: 1, borderColor: LINHA, borderRadius: 2 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: LINHA },
  trCab: { flexDirection: "row", backgroundColor: FUNDO, borderBottomWidth: 1, borderBottomColor: LINHA },
  th: { padding: 4, fontSize: 6.5, fontFamily: "Helvetica-Bold", flex: 1 },
  td: { padding: 4, fontSize: 6.5, flex: 1 },
  aviso: { backgroundColor: "#fbf2df", borderRadius: 3, padding: 8, marginTop: 6, fontSize: 7.5 },
  rodape: { position: "absolute", bottom: 18, left: 30, right: 30, fontSize: 7, color: SUAVE, textAlign: "center" },
});

function n(v: number | null | undefined): string {
  return v == null ? "—" : v.toLocaleString("pt-BR");
}

function Cartao({ rotulo, valor, delta }: { rotulo: string; valor: string; delta?: number | null }) {
  return (
    <View style={s.cartao}>
      <Text style={s.cartaoRotulo}>{rotulo}</Text>
      <Text style={s.cartaoValor}>{valor}</Text>
      {delta != null && (
        <Text style={delta >= 0 ? s.deltaPos : s.deltaNeg}>
          {delta >= 0 ? "+" : ""}
          {delta.toFixed(1)}% vs anterior
        </Text>
      )}
    </View>
  );
}

function Rodape() {
  return (
    <Text style={s.rodape} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
  );
}

export function DashboardReportDocument({ data }: { data: DashboardReportData }) {
  const { instagram: ig, instagramAnterior: igAnt, posts, stories, facebook: fb, facebookAnterior: fbAnt } = data;

  const somaStories = (pick: (x: (typeof stories)[number]) => number | null) =>
    stories.reduce((acc, x) => acc + (pick(x) ?? 0), 0);

  const topPosts = [...posts].sort((a, b) => (b.alcance ?? 0) - (a.alcance ?? 0)).slice(0, 10);
  const reels = [...posts]
    .filter((p) => p.mediaType === "REELS" || p.mediaType === "VIDEO")
    .sort((a, b) => (b.alcance ?? 0) - (a.alcance ?? 0))
    .slice(0, 5);

  const porTipo = Object.entries(
    posts.reduce<Record<string, { posts: number; alcance: number; interacoes: number }>>((acc, p) => {
      const rotulo = MEDIA_TYPE_LABEL[p.mediaType] ?? p.mediaType;
      const b = acc[rotulo] ?? { posts: 0, alcance: 0, interacoes: 0 };
      b.posts += 1;
      b.alcance += p.alcance ?? 0;
      b.interacoes += p.interacoes ?? p.curtidas + p.comentarios;
      acc[rotulo] = b;
      return acc;
    }, {})
  );

  const fbPorTipo = Object.entries(
    data.facebookPosts.reduce<Record<string, { count: number; reacoes: number; comentarios: number }>>((acc, p) => {
      const b = acc[p.postType] ?? { count: 0, reacoes: 0, comentarios: 0 };
      b.count += 1;
      b.reacoes += p.reactions;
      b.comentarios += p.comments;
      acc[p.postType] = b;
      return acc;
    }, {})
  );

  return (
    <Document>
      {/* ---------- PÁGINA 1: INSTAGRAM ---------- */}
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>Relatório de {data.client.name}</Text>
        <Text style={s.suave}>
          Dados de {data.rangeLabel}, comparados com o período anterior de mesma duração.
        </Text>

        <Text style={s.rede}>INSTAGRAM — @{data.igUsername}</Text>

        <View style={s.linhaCartoes}>
          <Cartao rotulo="Seguidores" valor={n(ig.followers)} />
          <Cartao
            rotulo="Soma do alcance diário"
            valor={n(ig.alcanceSomaDiaria)}
            delta={pctChange(ig.alcanceSomaDiaria, igAnt.alcanceSomaDiaria)}
          />
          <Cartao
            rotulo="Alcance único no período"
            valor={n(ig.alcanceUnicoPeriodo)}
            delta={pctChange(ig.alcanceUnicoPeriodo, igAnt.alcanceUnicoPeriodo)}
          />
          <Cartao
            rotulo="Visualizações"
            valor={n(ig.visualizacoes)}
            delta={pctChange(ig.visualizacoes, igAnt.visualizacoes)}
          />
          <Cartao
            rotulo="Visitas ao perfil"
            valor={n(ig.visitasPerfil)}
            delta={pctChange(ig.visitasPerfil, igAnt.visitasPerfil)}
          />
          <Cartao
            rotulo="Contas engajadas"
            valor={n(ig.contasEngajadas)}
            delta={pctChange(ig.contasEngajadas, igAnt.contasEngajadas)}
          />
          <Cartao
            rotulo="Interações totais"
            valor={n(ig.interacoesTotais)}
            delta={pctChange(ig.interacoesTotais, igAnt.interacoesTotais)}
          />
          <Cartao
            rotulo="Cliques no site"
            valor={n(ig.cliquesNoSite)}
            delta={pctChange(ig.cliquesNoSite, igAnt.cliquesNoSite)}
          />
        </View>

        {data.insights.length > 0 && (
          <>
            <Text style={s.h3}>Insights do período</Text>
            {data.insights.map((l, i) => (
              <Text key={i} style={{ fontSize: 8, marginBottom: 2 }}>
                • {l}
              </Text>
            ))}
          </>
        )}

        <Text style={s.h3}>Desempenho por formato</Text>
        <View style={s.tabela}>
          <View style={s.trCab}>
            <Text style={{ ...s.th, flex: 1.5 }}>Formato</Text>
            <Text style={s.th}>Posts</Text>
            <Text style={s.th}>Alcance</Text>
            <Text style={s.th}>Interações</Text>
          </View>
          {porTipo.length === 0 && (
            <View style={s.tr}>
              <Text style={s.td}>Nenhuma postagem no período.</Text>
            </View>
          )}
          {porTipo.map(([tipo, v]) => (
            <View key={tipo} style={s.tr}>
              <Text style={{ ...s.td, flex: 1.5 }}>{tipo}</Text>
              <Text style={s.td}>{v.posts}</Text>
              <Text style={s.td}>{n(v.alcance)}</Text>
              <Text style={s.td}>{n(v.interacoes)}</Text>
            </View>
          ))}
        </View>

        <Text style={s.h3}>Postagens em destaque ({posts.length} no total)</Text>
        <View style={s.tabela}>
          <View style={s.trCab}>
            <Text style={{ ...s.th, flex: 3 }}>Postagem</Text>
            <Text style={s.th}>Tipo</Text>
            <Text style={s.th}>Alcance</Text>
            <Text style={s.th}>Visualiz.</Text>
            <Text style={s.th}>Curtidas</Text>
            <Text style={s.th}>Coment.</Text>
            <Text style={s.th}>Salvos</Text>
            <Text style={s.th}>Taxa</Text>
          </View>
          {topPosts.length === 0 && (
            <View style={s.tr}>
              <Text style={s.td}>Nenhuma postagem no período.</Text>
            </View>
          )}
          {topPosts.map((p) => {
            const inter = p.interacoes ?? p.curtidas + p.comentarios + (p.salvos ?? 0);
            const taxa = p.alcance && p.alcance > 0 ? (inter / p.alcance) * 100 : null;
            return (
              <View key={p.id} style={s.tr}>
                <Text style={{ ...s.td, flex: 3 }}>{(p.caption ?? "(sem legenda)").slice(0, 52)}</Text>
                <Text style={s.td}>{MEDIA_TYPE_LABEL[p.mediaType] ?? p.mediaType}</Text>
                <Text style={s.td}>{n(p.alcance)}</Text>
                <Text style={s.td}>{n(p.visualizacoes)}</Text>
                <Text style={s.td}>{n(p.curtidas)}</Text>
                <Text style={s.td}>{n(p.comentarios)}</Text>
                <Text style={s.td}>{n(p.salvos)}</Text>
                <Text style={s.td}>{taxa != null ? `${taxa.toFixed(1)}%` : "—"}</Text>
              </View>
            );
          })}
        </View>

        {reels.length > 0 && (
          <>
            <Text style={s.h3}>Reels em destaque</Text>
            <View style={s.tabela}>
              <View style={s.trCab}>
                <Text style={{ ...s.th, flex: 3 }}>Reel</Text>
                <Text style={s.th}>Alcance</Text>
                <Text style={s.th}>Visualiz.</Text>
                <Text style={s.th}>Curtidas</Text>
                <Text style={s.th}>Compart.</Text>
                <Text style={s.th}>Data</Text>
              </View>
              {reels.map((p) => (
                <View key={p.id} style={s.tr}>
                  <Text style={{ ...s.td, flex: 3 }}>{(p.caption ?? "(sem legenda)").slice(0, 52)}</Text>
                  <Text style={s.td}>{n(p.alcance)}</Text>
                  <Text style={s.td}>{n(p.visualizacoes)}</Text>
                  <Text style={s.td}>{n(p.curtidas)}</Text>
                  <Text style={s.td}>{n(p.compartilhamentos)}</Text>
                  <Text style={s.td}>{new Date(p.timestamp).toLocaleDateString("pt-BR")}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <Rodape />
      </Page>

      {/* ---------- PÁGINA 2: STORIES + FACEBOOK ---------- */}
      <Page size="A4" style={s.page}>
        <Text style={s.rede}>STORIES DO INSTAGRAM</Text>
        <Text style={s.suave}>
          A API do Meta só expõe Stories ativos (24h). Este histórico vem de uma captura diária da ferramenta,
          então só existem dados a partir do dia em que a captura começou.
        </Text>

        <View style={s.linhaCartoes}>
          <Cartao rotulo="Stories publicados" valor={n(stories.length)} />
          <Cartao rotulo="Visualizações" valor={n(somaStories((x) => x.impressions))} />
          <Cartao rotulo="Alcance somado" valor={n(somaStories((x) => x.reach))} />
          <Cartao rotulo="Respostas" valor={n(somaStories((x) => x.replies))} />
        </View>

        {stories.length > 0 && (
          <View style={s.tabela}>
            <View style={s.trCab}>
              <Text style={s.th}>Data</Text>
              <Text style={s.th}>Visualiz.</Text>
              <Text style={s.th}>Alcance</Text>
              <Text style={s.th}>Interações</Text>
              <Text style={s.th}>Respostas</Text>
              <Text style={s.th}>Avançar</Text>
              <Text style={s.th}>Voltar</Text>
              <Text style={s.th}>Saiu</Text>
              <Text style={s.th}>Retenção</Text>
            </View>
            {stories.map((x) => {
              const ret =
                x.impressions && x.impressions > 0 && x.exits != null
                  ? ((x.impressions - x.exits) / x.impressions) * 100
                  : null;
              return (
                <View key={x.id} style={s.tr}>
                  <Text style={s.td}>{x.timestamp.toLocaleDateString("pt-BR")}</Text>
                  <Text style={s.td}>{n(x.impressions)}</Text>
                  <Text style={s.td}>{n(x.reach)}</Text>
                  <Text style={s.td}>{n(x.interactions)}</Text>
                  <Text style={s.td}>{n(x.replies)}</Text>
                  <Text style={s.td}>{n(x.tapsForward)}</Text>
                  <Text style={s.td}>{n(x.tapsBack)}</Text>
                  <Text style={s.td}>{n(x.exits)}</Text>
                  <Text style={s.td}>{ret != null ? `${ret.toFixed(1)}%` : "—"}</Text>
                </View>
              );
            })}
          </View>
        )}

        {data.pageId && (
          <>
            <Text style={s.rede}>FACEBOOK — {data.pageName}</Text>

            {fb && !fb.temMetricasDePagina && (
              <View style={s.aviso}>
                <Text>
                  O Meta removeu as métricas de Página da API: alcance, visualizações e engajamento da Página
                  deixaram de ser oferecidos. Não é falta de permissão nem de atividade, e não há como contornar.
                  Seguem disponíveis o número de seguidores e os dados por postagem.
                </Text>
              </View>
            )}

            <View style={s.linhaCartoes}>
              <Cartao rotulo="Seguidores da página" valor={n(fb?.seguidores ?? null)} />
              <Cartao
                rotulo="Visualizações da página"
                valor={n(fb?.visualizacoesPagina ?? null)}
                delta={pctChange(fb?.visualizacoesPagina ?? null, fbAnt?.visualizacoesPagina ?? null)}
              />
              <Cartao
                rotulo="Engajamento nos posts"
                valor={n(fb?.engajamentoPosts ?? null)}
                delta={pctChange(fb?.engajamentoPosts ?? null, fbAnt?.engajamentoPosts ?? null)}
              />
              <Cartao
                rotulo="Novos seguidores"
                valor={n(fb?.novosSeguidores ?? null)}
                delta={pctChange(fb?.novosSeguidores ?? null, fbAnt?.novosSeguidores ?? null)}
              />
            </View>

            <Text style={s.h3}>Postagens por tipo</Text>
            <View style={s.tabela}>
              <View style={s.trCab}>
                <Text style={{ ...s.th, flex: 1.5 }}>Tipo</Text>
                <Text style={s.th}>Postagens</Text>
                <Text style={s.th}>Reações</Text>
                <Text style={s.th}>Comentários</Text>
              </View>
              {fbPorTipo.length === 0 && (
                <View style={s.tr}>
                  <Text style={s.td}>Nenhuma postagem no Facebook neste período.</Text>
                </View>
              )}
              {fbPorTipo.map(([tipo, v]) => (
                <View key={tipo} style={s.tr}>
                  <Text style={{ ...s.td, flex: 1.5 }}>{tipo}</Text>
                  <Text style={s.td}>{v.count}</Text>
                  <Text style={s.td}>{n(v.reacoes)}</Text>
                  <Text style={s.td}>{n(v.comentarios)}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <Rodape />
      </Page>
    </Document>
  );
}
