import type { Briefing, Client } from "@prisma/client";
import type { Keyword } from "@/lib/keywords/provider";
import { retrieveRelevantChunks } from "@/lib/rag/retrieve";
import { formatClientRules } from "@/lib/clientRules";

// Monta o bloco de "contexto do cliente" (RAG) que entra no prompt da IA.
// A query de busca semântica usa o briefing para trazer os trechos da base
// de conhecimento mais relevantes para o mês.
export async function buildClientKnowledgeContext(clientId: string, searchQuery: string): Promise<string> {
  // As regras fixas entram aqui, e não em cada chamada, para que todo prompt do
  // cliente as receba sem depender de alguém lembrar de somá-las.
  const [chunks, regras] = await Promise.all([
    retrieveRelevantChunks(clientId, searchQuery, 8),
    formatClientRules(clientId),
  ]);

  const base =
    chunks.length === 0
      ? "Nenhum documento de contexto foi cadastrado para este cliente ainda."
      : chunks.map((chunk, i) => `[Trecho ${i + 1}]\n${chunk.content}`).join("\n\n");

  return [base, regras].filter(Boolean).join("\n\n");
}

export function formatKeywordsList(keywords: Keyword[]): string {
  if (keywords.length === 0) return "Nenhuma palavra-chave cadastrada para o período.";
  return keywords.map((k) => `- ${k.term}${k.volume > 0 ? ` (volume: ${k.volume})` : ""}`).join("\n");
}

export type TopPerformer = {
  caption?: string;
  media_type: string;
  like_count?: number;
  comments_count?: number;
  timestamp: string;
};

// Lista os posts que mais engajaram no perfil do cliente, para a IA se apoiar em
// evidência real de audiência em vez de suposição sobre o nicho.
export function formatTopPerformers(posts: TopPerformer[]): string {
  if (posts.length === 0) return "";

  return posts
    .map((post) => {
      const interacoes = (post.like_count ?? 0) + (post.comments_count ?? 0);
      const quando = post.timestamp.slice(0, 7);
      const legenda = (post.caption ?? "(sem legenda)").replace(/\s+/g, " ").slice(0, 180);
      return `- [${post.media_type}, ${quando}, ${interacoes} interações] ${legenda}`;
    })
    .join("\n");
}

export function formatBriefing(briefing: Briefing): string {
  return [
    `Período: ${briefing.period}`,
    briefing.goals,
    briefing.keyDates ? `Datas comemorativas: ${briefing.keyDates}` : null,
    briefing.suggestedThemes ? `Temas sugeridos pelo redator:\n${briefing.suggestedThemes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function briefingSearchQuery(briefing: Briefing): string {
  return briefing.goals;
}

export function formatClientInfo(client: Client): string {
  return `Cliente: ${client.name}\nNicho: ${client.niche}`;
}
