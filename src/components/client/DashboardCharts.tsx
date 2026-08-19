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

export function ReachLineChart({ data }: { data: { date: string; value: number }[] }) {
  if (data.length === 0) {
    return <p className="p-6 text-center text-sm text-tinta-3">Sem dados diários de alcance para este período.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--linha))" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => d.slice(8, 10)} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Line type="monotone" dataKey="value" name="Alcance" stroke="hsl(var(--mata))" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ComparisonBarChart({
  reach,
  prevReach,
  profileViews,
  prevProfileViews,
}: {
  reach: number;
  prevReach: number;
  profileViews: number;
  prevProfileViews: number;
}) {
  const data = [
    { name: "Alcance", "Este período": reach, "Período anterior": prevReach },
    { name: "Visitas ao perfil", "Este período": profileViews, "Período anterior": prevProfileViews },
  ];

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--linha))" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Este período" fill="hsl(var(--mata))" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Período anterior" fill="hsl(var(--linha-2))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
