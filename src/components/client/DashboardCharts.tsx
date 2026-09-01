"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from "recharts";

const VERDE = "hsl(var(--mata))";
const CINZA = "hsl(var(--bruma))";
const LINHA = "hsl(var(--linha))";

function Vazio({ children }: { children: string }) {
  return <p className="p-6 text-center text-sm text-tinta-3">{children}</p>;
}

export function ReachLineChart({ data }: { data: { date: string; value: number }[] }) {
  if (data.length === 0) return <Vazio>Sem dados diários de alcance para este período.</Vazio>;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={LINHA} />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => d.slice(8, 10)} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip labelFormatter={(d) => new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR")} />
        <Line type="monotone" dataKey="value" name="Alcance" stroke={VERDE} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// Alcance e visualizações no mesmo gráfico: visualizações é sempre maior, e ver as
// duas juntas mostra quanta repetição de visualização houve sobre o mesmo público.
export function AlcanceEVisualizacoesChart({
  alcance,
  visualizacoes,
}: {
  alcance: { date: string; value: number }[];
  visualizacoes: { date: string; value: number }[];
}) {
  if (alcance.length === 0 && visualizacoes.length === 0) {
    return <Vazio>Sem série diária para este período.</Vazio>;
  }

  const porData = new Map<string, { date: string; alcance?: number; visualizacoes?: number }>();
  for (const p of alcance) porData.set(p.date, { ...porData.get(p.date), date: p.date, alcance: p.value });
  for (const p of visualizacoes)
    porData.set(p.date, { ...porData.get(p.date), date: p.date, visualizacoes: p.value });

  const data = [...porData.values()].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={LINHA} />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => d.slice(8, 10)} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip labelFormatter={(d) => new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR")} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="visualizacoes" name="Visualizações" stroke={CINZA} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="alcance" name="Alcance" stroke={VERDE} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ComparisonBarChart({
  linhas,
}: {
  linhas: { nome: string; atual: number | null; anterior: number | null }[];
}) {
  const data = linhas
    .filter((l) => l.atual != null || l.anterior != null)
    .map((l) => ({ name: l.nome, "Este período": l.atual ?? 0, "Período anterior": l.anterior ?? 0 }));

  if (data.length === 0) return <Vazio>Sem dados para comparar.</Vazio>;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={LINHA} />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Este período" fill={VERDE} radius={[4, 4, 0, 0]} />
        <Bar dataKey="Período anterior" fill={CINZA} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Desempenho por tipo de post: mostra se Reels, carrossel ou imagem única rende
// mais naquele perfil, que é a decisão de formato do mês seguinte.
export function PorTipoBarChart({
  data,
}: {
  data: { tipo: string; posts: number; alcance: number; interacoes: number }[];
}) {
  if (data.length === 0) return <Vazio>Nenhuma postagem no período.</Vazio>;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={LINHA} />
        <XAxis dataKey="tipo" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="alcance" name="Alcance" fill={VERDE} radius={[4, 4, 0, 0]} />
        <Bar dataKey="interacoes" name="Interações" fill={CINZA} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
