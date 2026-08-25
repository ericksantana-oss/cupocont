import { askAI } from "@/lib/ai/llm";
import type { PeriodMedia } from "@/lib/meta/graph";

const SYSTEM = `Você analisa dados de desempenho de Instagram para uma agência que atende exclusivamente
clientes do mercado imobiliário. Escreva de 3 a 5 insights curtos e diretos em português, cada um em
uma linha, sem markdown, sem numeração — comece cada linha com um travessão "- ". Foque em padrões
acionáveis: que tipo de post performou melhor, se o alcance/engajamento subiu ou caiu vs o mês anterior,
e o que vale repetir ou evitar no próximo mês. Não invente números que não foram fornecidos.`;

export async function generateDashboardInsights(input: {
  clientName: string;
  period: string;
  reach: number;
  prevReach: number;
  profileViews: number;
  prevProfileViews: number;
  followers: number;
  media: PeriodMedia[];
}): Promise<string[]> {
  if (input.media.length === 0) return [];

  const postsSummary = input.media
    .map((m) => {
      const interactions = m.like_count + m.comments_count + (m.saved ?? 0) + (m.shares ?? 0);
      return `- ${m.media_type}: alcance ${m.reach ?? "?"}, curtidas ${m.like_count}, comentários ${m.comments_count}, salvos ${m.saved ?? "?"}, interações totais ${interactions}`;
    })
    .join("\n");

  const userMessage = `Cliente: ${input.clientName}
Período: ${input.period}
Seguidores atuais: ${input.followers}
Alcance no período: ${input.reach} (mês anterior: ${input.prevReach})
Visitas ao perfil no período: ${input.profileViews} (mês anterior: ${input.prevProfileViews})

Posts do período:
${postsSummary}`;

  const text = await askAI(SYSTEM, userMessage);
  return text
    .split("\n")
    .map((line) => line.replace(/^-\s*/, "").trim())
    .filter(Boolean);
}
