import { db } from "@/lib/db";
import { parsePeriod, formatPeriod } from "@/lib/periodo";

export type TendenciaCliente = {
  clientId: string;
  clientName: string;
  meses: { period: string; reach: number | null; followers: number | null }[];
  variacao: number | null; // % do último mês fechado contra o anterior
  emQueda: boolean;
};

// Quantos meses fechados olhar para trás na visão de portfólio.
const MESES_ANALISADOS = 4;

function mesAnterior(period: string, passos = 1): string {
  const { month, year } = parsePeriod(period);
  const d = new Date(year, month - 1 - passos, 1);
  return formatPeriod(d.getMonth() + 1, d.getFullYear());
}

// O mês corrente é ignorado nas comparações: ele ainda está sendo somado e
// pareceria queda contra um mês inteiro.
export function ultimoMesFechado(hoje = new Date()): string {
  return mesAnterior(formatPeriod(hoje.getMonth() + 1, hoje.getFullYear()));
}

export async function listarTendencias(clientIds: string[]): Promise<TendenciaCliente[]> {
  if (clientIds.length === 0) return [];

  const fechado = ultimoMesFechado();
  const janela = Array.from({ length: MESES_ANALISADOS }, (_, i) => mesAnterior(fechado, i)).reverse();

  const [clientes, snapshots] = await Promise.all([
    db.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, name: true } }),
    db.metricSnapshot.findMany({
      where: { clientId: { in: clientIds }, period: { in: janela } },
      orderBy: { period: "asc" },
    }),
  ]);

  const porCliente = new Map<string, typeof snapshots>();
  for (const s of snapshots) {
    const lista = porCliente.get(s.clientId) ?? [];
    lista.push(s);
    porCliente.set(s.clientId, lista);
  }

  return clientes
    .map((cliente) => {
      const meses = janela.map((period) => {
        const s = porCliente.get(cliente.id)?.find((x) => x.period === period);
        return { period, reach: s?.reach ?? null, followers: s?.followers ?? null };
      });

      const comDado = meses.filter((m) => m.reach != null);
      const ultimo = comDado.at(-1);
      const penultimo = comDado.at(-2);

      const variacao =
        ultimo?.reach != null && penultimo?.reach != null && penultimo.reach > 0
          ? ((ultimo.reach - penultimo.reach) / penultimo.reach) * 100
          : null;

      // Queda só é sinalizada com dois meses consecutivos caindo. Um mês fraco
      // isolado é ruído — campanha que acabou, feriado, qualquer coisa.
      const emQueda =
        comDado.length >= 3 &&
        comDado.slice(-3).every((m, i, arr) => i === 0 || (m.reach ?? 0) < (arr[i - 1].reach ?? 0));

      return {
        clientId: cliente.id,
        clientName: cliente.name,
        meses,
        variacao,
        emQueda,
      };
    })
    .sort((a, b) => {
      if (a.emQueda !== b.emQueda) return a.emQueda ? -1 : 1;
      return (a.variacao ?? 0) - (b.variacao ?? 0);
    });
}
