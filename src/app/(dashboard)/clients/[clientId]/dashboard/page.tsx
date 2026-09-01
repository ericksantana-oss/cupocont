import Link from "next/link";
import { ArrowLeft, ArrowUpDown, Download, Sparkles, Instagram, Facebook, AlertCircle } from "lucide-react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireClientAccess } from "@/lib/auth/guards";
import { DateRangeSelect } from "@/components/client/DateRangeSelect";
import {
  ReachLineChart,
  AlcanceEVisualizacoesChart,
  ComparisonBarChart,
  PorTipoBarChart,
} from "@/components/client/DashboardCharts";
import { defaultRange, pctChange, MEDIA_TYPE_LABEL, loadDashboardReportData } from "@/lib/reportData";
import type { PostInstagram } from "@/lib/meta/insights";

type SortKey = "date" | "reach" | "views" | "likes" | "comments" | "saved" | "shares" | "rate";
const SORT_KEYS = ["date", "reach", "views", "likes", "comments", "saved", "shares", "rate"] as const;

function taxaInteracao(p: PostInstagram): number | null {
  const interacoes = p.interacoes ?? p.curtidas + p.comentarios + (p.salvos ?? 0) + (p.compartilhamentos ?? 0);
  return p.alcance && p.alcance > 0 ? (interacoes / p.alcance) * 100 : null;
}

function ordenar(posts: PostInstagram[], sort: SortKey, dir: "asc" | "desc"): PostInstagram[] {
  const valor = (p: PostInstagram): number => {
    switch (sort) {
      case "date": return new Date(p.timestamp).getTime();
      case "reach": return p.alcance ?? -1;
      case "views": return p.visualizacoes ?? -1;
      case "likes": return p.curtidas;
      case "comments": return p.comentarios;
      case "saved": return p.salvos ?? -1;
      case "shares": return p.compartilhamentos ?? -1;
      case "rate": return taxaInteracao(p) ?? -1;
    }
  };
  return [...posts].sort((a, b) => (dir === "asc" ? valor(a) - valor(b) : valor(b) - valor(a)));
}

export default async function ClientDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ from?: string; to?: string; sort?: string; dir?: string }>;
}) {
  const { clientId } = await params;
  const padrao = defaultRange();
  const { from = padrao.from, to = padrao.to, sort = "date", dir = "desc" } = await searchParams;
  const sortKey = SORT_KEYS.includes(sort as SortKey) ? (sort as SortKey) : "date";
  const sortDir = dir === "asc" ? "asc" : "desc";

  await requireClientAccess(clientId);

  const client = await db.client.findUnique({ where: { id: clientId } });
  if (!client) notFound();

  const Cabecalho = (
    <>
      <Link href={`/clients/${clientId}`} className="inline-flex items-center text-sm text-tinta-3 hover:text-tinta">
        <ArrowLeft className="mr-1.5 size-4" strokeWidth={1.5} />
        {client.name}
      </Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
        <h1 className="display text-3xl">Relatório de resultados</h1>
        <DateRangeSelect from={from} to={to} />
      </div>
    </>
  );

  const data = await loadDashboardReportData(clientId, from, to);

  if (!data) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        {Cabecalho}
        <div className="cartao mt-8 p-8 text-center text-sm text-tinta-3">
          Conecte o Instagram do cliente na{" "}
          <Link href={`/clients/${clientId}/contexto`} className="text-mata underline">
            aba de Contexto
          </Link>{" "}
          para ver os resultados aqui.
        </div>
      </div>
    );
  }

  const { instagram: ig, instagramAnterior: igAnt, posts, stories, facebook: fb, facebookAnterior: fbAnt } = data;
  const ordenados = ordenar(posts, sortKey, sortDir);

  function linkOrdem(key: SortKey) {
    const proxima = sortKey === key && sortDir === "desc" ? "asc" : "desc";
    return `/clients/${clientId}/dashboard?from=${from}&to=${to}&sort=${key}&dir=${proxima}`;
  }

  const soma = <T,>(arr: T[], pick: (x: T) => number | null | undefined) =>
    arr.reduce((s, x) => s + (pick(x) ?? 0), 0);

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
  ).map(([tipo, v]) => ({ tipo, ...v }));

  const reels = posts.filter((p) => p.mediaType === "REELS" || p.mediaType === "VIDEO");
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
    <div className="mx-auto max-w-6xl px-6 py-10">
      {Cabecalho}
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-tinta-3">
          Dados de {data.rangeLabel}, comparados com o período anterior de mesma duração.
        </p>
        <a
          href={`/api/clients/${clientId}/report?from=${from}&to=${to}`}
          className="inline-flex items-center gap-1.5 rounded-controle border border-linha bg-carta px-3 py-1.5 text-sm shadow-carta hover:bg-linha-2"
        >
          <Download className="size-4" strokeWidth={1.5} />
          Baixar PDF
        </a>
      </div>

      {data.insights.length > 0 && (
        <div className="cartao mt-6 p-6">
          <h2 className="flex items-center gap-1.5 rotulo">
            <Sparkles className="size-3.5" strokeWidth={1.5} />
            Insights do período
          </h2>
          <ul className="mt-3 space-y-1.5 text-sm">
            {data.insights.map((l, i) => (
              <li key={i}>• {l}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ================= INSTAGRAM ================= */}
      <Secao icone={<Instagram className="size-4" strokeWidth={1.5} />} titulo="Instagram" sub={`@${data.igUsername}`} />

      <div className="mt-4 grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <Metrica rotulo="Seguidores" valor={ig.followers} />
        <Metrica
          rotulo="Soma do alcance diário"
          valor={ig.alcanceSomaDiaria}
          delta={pctChange(ig.alcanceSomaDiaria, igAnt.alcanceSomaDiaria)}
          nota="Soma do alcance de cada dia"
        />
        <Metrica
          rotulo="Alcance único no período"
          valor={ig.alcanceUnicoPeriodo}
          delta={pctChange(ig.alcanceUnicoPeriodo, igAnt.alcanceUnicoPeriodo)}
          nota="Sem repetir quem apareceu em vários dias"
        />
        <Metrica
          rotulo="Visualizações"
          valor={ig.visualizacoes}
          delta={pctChange(ig.visualizacoes, igAnt.visualizacoes)}
          nota="Total da conta, inclui impulsionado"
        />
        <Metrica
          rotulo="Visitas ao perfil"
          valor={ig.visitasPerfil}
          delta={pctChange(ig.visitasPerfil, igAnt.visitasPerfil)}
        />
        <Metrica
          rotulo="Contas engajadas"
          valor={ig.contasEngajadas}
          delta={pctChange(ig.contasEngajadas, igAnt.contasEngajadas)}
        />
        <Metrica
          rotulo="Interações totais"
          valor={ig.interacoesTotais}
          delta={pctChange(ig.interacoesTotais, igAnt.interacoesTotais)}
        />
        <Metrica
          rotulo="Cliques no site"
          valor={ig.cliquesNoSite}
          delta={pctChange(ig.cliquesNoSite, igAnt.cliquesNoSite)}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Grafico titulo="Alcance e visualizações por dia">
          <AlcanceEVisualizacoesChart alcance={ig.serieAlcance} visualizacoes={ig.serieVisualizacoes} />
        </Grafico>
        <Grafico titulo="Comparativo com o período anterior">
          <ComparisonBarChart
            linhas={[
              { nome: "Alcance", atual: ig.alcanceSomaDiaria, anterior: igAnt.alcanceSomaDiaria },
              { nome: "Visualizações", atual: ig.visualizacoes, anterior: igAnt.visualizacoes },
              { nome: "Visitas ao perfil", atual: ig.visitasPerfil, anterior: igAnt.visitasPerfil },
              { nome: "Interações", atual: ig.interacoesTotais, anterior: igAnt.interacoesTotais },
            ]}
          />
        </Grafico>
        <Grafico titulo="Desempenho por formato">
          <PorTipoBarChart data={porTipo} />
        </Grafico>
        <Grafico titulo="Alcance diário">
          <ReachLineChart data={ig.serieAlcance} />
        </Grafico>
      </div>

      <h3 className="mt-8 rotulo">Postagens do período ({posts.length})</h3>
      <div className="cartao mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-linha bg-linha-2 text-left">
            <tr>
              <th className="p-3">Postagem</th>
              <th className="p-3">Tipo</th>
              <Ordenavel rotulo="Data" chave="date" ativa={sortKey} dir={sortDir} href={linkOrdem("date")} />
              <Ordenavel rotulo="Alcance" chave="reach" ativa={sortKey} dir={sortDir} href={linkOrdem("reach")} />
              <Ordenavel rotulo="Visualiz." chave="views" ativa={sortKey} dir={sortDir} href={linkOrdem("views")} />
              <Ordenavel rotulo="Curtidas" chave="likes" ativa={sortKey} dir={sortDir} href={linkOrdem("likes")} />
              <Ordenavel rotulo="Coment." chave="comments" ativa={sortKey} dir={sortDir} href={linkOrdem("comments")} />
              <Ordenavel rotulo="Salvos" chave="saved" ativa={sortKey} dir={sortDir} href={linkOrdem("saved")} />
              <Ordenavel rotulo="Compart." chave="shares" ativa={sortKey} dir={sortDir} href={linkOrdem("shares")} />
              <th className="p-3 whitespace-nowrap">Seguiram</th>
              <Ordenavel rotulo="Taxa" chave="rate" ativa={sortKey} dir={sortDir} href={linkOrdem("rate")} />
            </tr>
          </thead>
          <tbody>
            {ordenados.length === 0 && (
              <tr>
                <td colSpan={11} className="p-6 text-center text-tinta-3">
                  Nenhuma postagem no período.
                </td>
              </tr>
            )}
            {ordenados.map((p) => {
              const taxa = taxaInteracao(p);
              return (
                <tr key={p.id} className="border-b border-linha-2">
                  <td className="max-w-xs truncate p-3">
                    <a href={p.permalink} target="_blank" rel="noreferrer" className="hover:underline">
                      {p.caption ? p.caption.slice(0, 60) : "(sem legenda)"}
                    </a>
                  </td>
                  <td className="p-3 whitespace-nowrap">{MEDIA_TYPE_LABEL[p.mediaType] ?? p.mediaType}</td>
                  <td className="p-3 whitespace-nowrap">{new Date(p.timestamp).toLocaleDateString("pt-BR")}</td>
                  <Num v={p.alcance} />
                  <Num v={p.visualizacoes} />
                  <Num v={p.curtidas} />
                  <Num v={p.comentarios} />
                  <Num v={p.salvos} />
                  <Num v={p.compartilhamentos} />
                  <Num v={p.novosSeguidores} />
                  <td className="p-3 tabular-nums">{taxa != null ? `${taxa.toFixed(1)}%` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {reels.length > 0 && (
        <>
          <h3 className="mt-8 rotulo">Reels em destaque</h3>
          <div className="cartao mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-linha bg-linha-2 text-left">
                <tr>
                  <th className="p-3">Reel</th>
                  <th className="p-3">Alcance</th>
                  <th className="p-3">Visualiz.</th>
                  <th className="p-3">Curtidas</th>
                  <th className="p-3">Coment.</th>
                  <th className="p-3">Compart.</th>
                  <th className="p-3">Data</th>
                </tr>
              </thead>
              <tbody>
                {[...reels]
                  .sort((a, b) => (b.alcance ?? 0) - (a.alcance ?? 0))
                  .map((p) => (
                    <tr key={p.id} className="border-b border-linha-2">
                      <td className="max-w-xs truncate p-3">{p.caption?.slice(0, 60) ?? "(sem legenda)"}</td>
                      <Num v={p.alcance} />
                      <Num v={p.visualizacoes} />
                      <Num v={p.curtidas} />
                      <Num v={p.comentarios} />
                      <Num v={p.compartilhamentos} />
                      <td className="p-3 whitespace-nowrap">{new Date(p.timestamp).toLocaleDateString("pt-BR")}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ================= STORIES ================= */}
      <Secao icone={<Instagram className="size-4" strokeWidth={1.5} />} titulo="Stories do Instagram" sub={`${stories.length} no período`} />
      <p className="mt-1 text-xs text-tinta-3">
        A API do Meta só expõe Stories ativos (24h). Este histórico vem de uma captura diária da própria
        ferramenta, então só existem dados a partir do dia em que a captura começou.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-4">
        <Metrica rotulo="Stories publicados" valor={stories.length} />
        <Metrica rotulo="Visualizações" valor={soma(stories, (s) => s.impressions)} />
        <Metrica rotulo="Alcance somado" valor={soma(stories, (s) => s.reach)} />
        <Metrica rotulo="Respostas" valor={soma(stories, (s) => s.replies)} />
      </div>

      {stories.length > 0 && (
        <div className="cartao mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-linha bg-linha-2 text-left">
              <tr>
                <th className="p-3">Data</th>
                <th className="p-3">Visualiz.</th>
                <th className="p-3">Alcance</th>
                <th className="p-3">Interações</th>
                <th className="p-3">Respostas</th>
                <th className="p-3">Compart.</th>
                <th className="p-3">Avançar</th>
                <th className="p-3">Voltar</th>
                <th className="p-3">Saiu</th>
                <th className="p-3">Retenção</th>
              </tr>
            </thead>
            <tbody>
              {stories.map((s) => {
                // Retenção: quantos não abandonaram o story. Mesma definição do Reportei.
                const retencao =
                  s.impressions && s.impressions > 0 && s.exits != null
                    ? ((s.impressions - s.exits) / s.impressions) * 100
                    : null;
                return (
                  <tr key={s.id} className="border-b border-linha-2">
                    <td className="p-3 whitespace-nowrap">{s.timestamp.toLocaleDateString("pt-BR")}</td>
                    <Num v={s.impressions} />
                    <Num v={s.reach} />
                    <Num v={s.interactions} />
                    <Num v={s.replies} />
                    <Num v={s.shares} />
                    <Num v={s.tapsForward} />
                    <Num v={s.tapsBack} />
                    <Num v={s.exits} />
                    <td className="p-3 tabular-nums">{retencao != null ? `${retencao.toFixed(1)}%` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ================= FACEBOOK ================= */}
      {data.pageId && (
        <>
          <Secao icone={<Facebook className="size-4" strokeWidth={1.5} />} titulo="Facebook" sub={data.pageName ?? ""} />

          {fb && !fb.temPermissaoInsights && (
            <div className="mt-3 flex items-start gap-2 rounded-controle bg-alerta/10 p-4 text-sm">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-alerta" strokeWidth={1.5} />
              <span>
                <strong>As métricas da Página estão indisponíveis por falta de permissão.</strong> O Meta exige a
                permissão <code className="text-xs">read_insights</code>, que não existia quando esta conta foi
                conectada — e ele responde com lista vazia em vez de recusar, o que faz parecer ausência de
                atividade. Reconecte o Facebook deste cliente na{" "}
                <Link href={`/clients/${clientId}/contexto`} className="text-mata underline">
                  aba de Contexto
                </Link>{" "}
                para liberar. Os números dos posts abaixo não dependem dela.
              </span>
            </div>
          )}

          <div className="mt-4 grid gap-4 sm:grid-cols-4">
            <Metrica rotulo="Seguidores da página" valor={fb?.seguidores ?? null} />
            <Metrica
              rotulo="Visualizações da página"
              valor={fb?.visualizacoesPagina ?? null}
              delta={pctChange(fb?.visualizacoesPagina ?? null, fbAnt?.visualizacoesPagina ?? null)}
            />
            <Metrica
              rotulo="Engajamento nos posts"
              valor={fb?.engajamentoPosts ?? null}
              delta={pctChange(fb?.engajamentoPosts ?? null, fbAnt?.engajamentoPosts ?? null)}
            />
            <Metrica
              rotulo="Novos seguidores"
              valor={fb?.novosSeguidores ?? null}
              delta={pctChange(fb?.novosSeguidores ?? null, fbAnt?.novosSeguidores ?? null)}
            />
          </div>

          <h3 className="mt-6 rotulo">Postagens por tipo</h3>
          <div className="cartao mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-linha bg-linha-2 text-left">
                <tr>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Postagens</th>
                  <th className="p-3">Reações</th>
                  <th className="p-3">Comentários</th>
                </tr>
              </thead>
              <tbody>
                {fbPorTipo.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-tinta-3">
                      Nenhuma postagem no Facebook neste período.
                    </td>
                  </tr>
                )}
                {fbPorTipo.map(([tipo, v]) => (
                  <tr key={tipo} className="border-b border-linha-2">
                    <td className="p-3">{tipo}</td>
                    <Num v={v.count} />
                    <Num v={v.reacoes} />
                    <Num v={v.comentarios} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.facebookPosts.length > 0 && (
            <>
              <h3 className="mt-6 rotulo">Postagens em destaque</h3>
              <div className="cartao mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-linha bg-linha-2 text-left">
                    <tr>
                      <th className="p-3">Postagem</th>
                      <th className="p-3">Tipo</th>
                      <th className="p-3">Reações</th>
                      <th className="p-3">Coment.</th>
                      <th className="p-3">Compart.</th>
                      <th className="p-3">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...data.facebookPosts]
                      .sort((a, b) => b.reactions + b.comments + b.shares - (a.reactions + a.comments + a.shares))
                      .slice(0, 10)
                      .map((p) => (
                        <tr key={p.id} className="border-b border-linha-2">
                          <td className="max-w-xs truncate p-3">
                            {p.permalink ? (
                              <a href={p.permalink} target="_blank" rel="noreferrer" className="hover:underline">
                                {p.message?.slice(0, 60) ?? "(sem legenda)"}
                              </a>
                            ) : (
                              (p.message?.slice(0, 60) ?? "(sem legenda)")
                            )}
                          </td>
                          <td className="p-3">{p.postType}</td>
                          <Num v={p.reactions} />
                          <Num v={p.comments} />
                          <Num v={p.shares} />
                          <td className="p-3 whitespace-nowrap">
                            {new Date(p.createdTime).toLocaleDateString("pt-BR")}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function Secao({ icone, titulo, sub }: { icone: React.ReactNode; titulo: string; sub: string }) {
  return (
    <div className="mt-10 flex flex-wrap items-center gap-2 border-b border-linha pb-2">
      <span className="flex size-7 items-center justify-center rounded-controle bg-mata/10 text-mata">{icone}</span>
      <h2 className="text-lg font-semibold">{titulo}</h2>
      {sub && <span className="text-sm text-tinta-3">{sub}</span>}
    </div>
  );
}

function Grafico({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="cartao p-5">
      <h3 className="rotulo">{titulo}</h3>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Num({ v }: { v: number | null | undefined }) {
  return <td className="p-3 tabular-nums">{v != null ? v.toLocaleString("pt-BR") : "—"}</td>;
}

function Metrica({
  rotulo,
  valor,
  delta,
  nota,
}: {
  rotulo: string;
  valor: number | null;
  delta?: number | null;
  nota?: string;
}) {
  return (
    <div className="cartao p-5">
      <p className="rotulo">{rotulo}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">
        {valor != null ? valor.toLocaleString("pt-BR") : "—"}
      </p>
      {delta != null && (
        <p className={`mt-1 text-xs ${delta >= 0 ? "text-mata" : "text-alerta"}`}>
          {delta >= 0 ? "+" : ""}
          {delta.toFixed(1)}% vs anterior
        </p>
      )}
      {nota && <p className="mt-1 text-xs text-tinta-3">{nota}</p>}
    </div>
  );
}

function Ordenavel({
  rotulo,
  chave,
  ativa,
  dir,
  href,
}: {
  rotulo: string;
  chave: SortKey;
  ativa: SortKey;
  dir: "asc" | "desc";
  href: string;
}) {
  const isAtiva = chave === ativa;
  return (
    <th className="p-3 whitespace-nowrap">
      <Link href={href} className={`inline-flex items-center gap-1 ${isAtiva ? "text-mata" : "hover:text-tinta"}`}>
        {rotulo}
        <ArrowUpDown className="size-3" strokeWidth={1.5} />
        {isAtiva && <span className="text-xs">{dir === "asc" ? "↑" : "↓"}</span>}
      </Link>
    </th>
  );
}
