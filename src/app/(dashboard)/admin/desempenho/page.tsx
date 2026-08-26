import Link from "next/link";
import { TrendingDown, ArrowRight } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { AdminTabNav } from "@/components/admin/AdminTabNav";
import { Badge } from "@/components/ui/badge";
import { periodLabel } from "@/lib/periodo";
import { listarTendencias, ultimoMesFechado } from "@/lib/metricHistory";

export default async function AdminPerformancePage() {
  await requireAdmin();

  const clientes = await db.client.findMany({
    where: { instagramAccount: { isNot: null } },
    select: { id: true },
  });
  const tendencias = await listarTendencias(clientes.map((c) => c.id));

  const meses = tendencias[0]?.meses.map((m) => m.period) ?? [];
  const emQueda = tendencias.filter((t) => t.emQueda);
  const semDado = tendencias.filter((t) => t.meses.every((m) => m.reach == null));

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="display text-3xl">Painel admin</h1>
      <p className="mt-1 text-sm text-tinta-3">
        Alcance mês a mês de cada cliente, para enxergar queda antes de o cliente reclamar.
      </p>

      <div className="mt-8">
        <AdminTabNav active="/admin/desempenho" />

        <div className="mt-6">
          {tendencias.length === 0 ? (
            <div className="cartao p-8 text-center text-sm text-tinta-3">
              Nenhum cliente com Instagram conectado ainda.
            </div>
          ) : (
            <>
              <p className="text-sm text-tinta-3">
                Comparando até {periodLabel(ultimoMesFechado())}. O mês corrente fica de fora porque ainda está
                sendo somado e pareceria queda contra um mês inteiro.
              </p>

              {emQueda.length > 0 && (
                <div className="mt-4 flex items-start gap-2 rounded-controle bg-alerta/10 p-4 text-sm">
                  <TrendingDown className="mt-0.5 size-4 shrink-0 text-alerta" strokeWidth={1.5} />
                  <span>
                    <strong>{emQueda.length} cliente(s) em queda</strong> — alcance caindo há três meses
                    seguidos: {emQueda.map((t) => t.clientName).join(", ")}.
                  </span>
                </div>
              )}

              <div className="cartao mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-linha bg-linha-2 text-left">
                    <tr>
                      <th className="p-3">Cliente</th>
                      {meses.map((m) => (
                        <th key={m} className="p-3 whitespace-nowrap text-right">
                          {periodLabel(m)}
                        </th>
                      ))}
                      <th className="p-3 text-right">Variação</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tendencias.map((t) => (
                      <tr key={t.clientId} className="border-b border-linha-2">
                        <td className="p-3">
                          <span className="font-medium">{t.clientName}</span>
                          {t.emQueda && (
                            <Badge variant="outline" className="ml-2 text-alerta">
                              em queda
                            </Badge>
                          )}
                        </td>
                        {t.meses.map((m) => (
                          <td key={m.period} className="p-3 text-right tabular-nums">
                            {m.reach != null ? m.reach.toLocaleString("pt-BR") : "—"}
                          </td>
                        ))}
                        <td className="p-3 text-right tabular-nums">
                          {t.variacao != null ? (
                            <span className={t.variacao >= 0 ? "text-mata" : "text-alerta"}>
                              {t.variacao >= 0 ? "+" : ""}
                              {t.variacao.toFixed(1)}%
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="p-3">
                          <Link
                            href={`/clients/${t.clientId}/dashboard`}
                            className="inline-flex items-center text-xs text-mata"
                          >
                            Abrir
                            <ArrowRight className="ml-1 size-3" strokeWidth={1.5} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {semDado.length === tendencias.length && (
                <p className="mt-4 text-sm text-tinta-3">
                  Ainda não há histórico gravado. A captura roda uma vez por dia, junto com as outras tarefas
                  automáticas, e cada mês só fica completo quando termina — a comparação entre meses aparece a
                  partir do segundo mês de captura.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
