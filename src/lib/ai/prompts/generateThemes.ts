import { askAI } from "@/lib/ai/llm";
import {
  formatBriefing,
  formatClientInfo,
  formatKeywordsList,
} from "@/lib/ai/contextBuilder";
import type { Briefing, Client } from "@prisma/client";
import type { Keyword } from "@/lib/keywords/provider";

export type SuggestedTheme = {
  title: string;
  justification: string;
};

const SYSTEM_PROMPT = `Você é um estrategista de conteúdo para redes sociais trabalhando para uma agência.
Sua tarefa é sugerir temas de posts para UM cliente específico, para o mês do briefing informado.

Regras obrigatórias:
- Siga RIGOROSAMENTE o "Contexto do cliente" abaixo (tom de voz, personas, glossário de termos permitidos/proibidos,
  histórico de conteúdo já publicado). Esse contexto tem prioridade sobre suposições genéricas sobre o nicho.
- Use as "Palavras-chave do período" como sinal de demanda real de busca, não como lista obrigatória — nem todo
  tema precisa citar uma keyword literalmente.
- Respeite os objetivos, campanhas, datas importantes e restrições do briefing.
- Não repita temas genéricos que ignorem o contexto do cliente.
- Se o briefing traz "Temas sugeridos pelo redator", eles são obrigatórios e vêm PRIMEIRO na
  lista, na ordem em que aparecem. Você pode reescrever o título para caber no tom de voz do
  cliente e deve explicar na justificativa como o tema se conecta ao briefing — mas não pode
  descartar nenhum nem fundir dois numa só entrada. Depois deles, complete com temas seus.
- Gere no MÍNIMO 20 temas distintos, contando os sugeridos pelo redator.

Responda APENAS com um JSON válido (sem markdown, sem texto antes ou depois), no formato:
[{"title": "...", "justification": "..."}, ...]
Cada "justification" deve ter 1-2 frases explicando por que esse tema é relevante agora (conectando briefing,
keyword e/ou contexto do cliente).`;

function buildUserMessage(params: {
  clientInfo: string;
  clientKnowledgeContext: string;
  briefingSummary: string;
  keywordsList: string;
}): string {
  return `## Contexto do cliente (base de conhecimento)
${params.clientKnowledgeContext}

## ${params.clientInfo}

## Briefing do mês
${params.briefingSummary}

## Palavras-chave do período
${params.keywordsList}

Gere agora a lista de temas em JSON, seguindo as regras do system prompt.`;
}

function parseThemesResponse(raw: string): SuggestedTheme[] {
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  const jsonText = jsonMatch ? jsonMatch[0] : raw;

  const parsed = JSON.parse(jsonText);
  if (!Array.isArray(parsed)) throw new Error("Resposta da IA não é uma lista de temas.");

  return parsed
    .filter((item) => typeof item?.title === "string" && typeof item?.justification === "string")
    .map((item) => ({ title: item.title.trim(), justification: item.justification.trim() }));
}

export async function generateThemes(params: {
  client: Client;
  briefing: Briefing;
  clientKnowledgeContext: string;
  keywords: Keyword[];
}): Promise<SuggestedTheme[]> {
  const userMessage = buildUserMessage({
    clientInfo: formatClientInfo(params.client),
    clientKnowledgeContext: params.clientKnowledgeContext,
    briefingSummary: formatBriefing(params.briefing),
    keywordsList: formatKeywordsList(params.keywords),
  });

  const raw = await askAI(SYSTEM_PROMPT, userMessage);
  return parseThemesResponse(raw);
}
