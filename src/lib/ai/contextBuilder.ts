import type { Briefing, Client } from "@prisma/client";
import type { Keyword } from "@/lib/keywords/provider";
import { retrieveRelevantChunks } from "@/lib/rag/retrieve";

// Monta o bloco de "contexto do cliente" (RAG) que entra no prompt da IA.
// A query de busca semântica usa o briefing para trazer os trechos da base
// de conhecimento mais relevantes para o mês.
export async function buildClientKnowledgeContext(clientId: string, searchQuery: string): Promise<string> {
  const chunks = await retrieveRelevantChunks(clientId, searchQuery, 8);

  if (chunks.length === 0) {
    return "Nenhum documento de contexto foi cadastrado para este cliente ainda.";
  }

  return chunks.map((chunk, i) => `[Trecho ${i + 1}]\n${chunk.content}`).join("\n\n");
}

export function formatKeywordsList(keywords: Keyword[]): string {
  if (keywords.length === 0) return "Nenhuma palavra-chave cadastrada para o período.";
  return keywords.map((k) => `- ${k.term}${k.volume > 0 ? ` (volume: ${k.volume})` : ""}`).join("\n");
}

export function formatBriefing(briefing: Briefing): string {
  return [
    `Período: ${briefing.period}`,
    briefing.goals,
    briefing.keyDates ? `Datas comemorativas: ${briefing.keyDates}` : null,
    briefing.suggestedThemes ? `Temas sugeridos pelo redator:
${briefing.suggestedThemes}` : null,
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
