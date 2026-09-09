import { askAI } from "@/lib/ai/llm";
import {
  formatBriefing,
  formatClientInfo,
  formatKeywordsList,
  formatTopPerformers,
  type TopPerformer,
} from "@/lib/ai/contextBuilder";
import type { Briefing, Client } from "@prisma/client";
import type { Keyword } from "@/lib/keywords/provider";

export type SuggestedTheme = {
  title: string;
  justification: string;
};

// Quantidade fechada de temas por mês. Fonte única: entra no prompt e limita a leitura
// da resposta, para os dois nunca discordarem.
const TOTAL_DE_TEMAS = 20;

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
- Se vier a seção "Posts que mais engajaram neste perfil", trate como evidência do que
  funciona com esta audiência específica. Reaproveite o ÂNGULO, o formato e o recorte que
  performaram — não o assunto em si. Repetir o mesmo tema é erro; repetir o que faz aquele
  público reagir é o objetivo.
- Gere EXATAMENTE ${TOTAL_DE_TEMAS} temas distintos, contando os sugeridos pelo redator.
  Se os sugeridos pelo redator já forem ${TOTAL_DE_TEMAS} ou mais, use só eles e pare em ${TOTAL_DE_TEMAS}.

Responda APENAS com um JSON válido (sem markdown, sem texto antes ou depois), no formato:
[{"title": "...", "justification": "..."}, ...]
Cada "justification" deve ter 1-2 frases explicando por que esse tema é relevante agora (conectando briefing,
keyword e/ou contexto do cliente).`;

function buildUserMessage(params: {
  clientInfo: string;
  clientKnowledgeContext: string;
  briefingSummary: string;
  keywordsList: string;
  topPerformers: string;
}): string {
  const blocoDestaques = params.topPerformers
    ? `\n## Posts que mais engajaram neste perfil\n${params.topPerformers}\n`
    : "";

  return `## Contexto do cliente (base de conhecimento)
${params.clientKnowledgeContext}

## ${params.clientInfo}

## Briefing do mês
${params.briefingSummary}

## Palavras-chave do período
${params.keywordsList}
${blocoDestaques}
Gere agora a lista de temas em JSON, seguindo as regras do system prompt.`;
}

function parseThemesResponse(raw: string): SuggestedTheme[] {
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  const jsonText = jsonMatch ? jsonMatch[0] : raw;

  const parsed = JSON.parse(jsonText);
  if (!Array.isArray(parsed)) throw new Error("Resposta da IA não é uma lista de temas.");

  return parsed
    .filter((item) => typeof item?.title === "string" && typeof item?.justification === "string")
    .map((item) => ({ title: item.title.trim(), justification: item.justification.trim() }))
    // Corte no código, e não só no prompt: pedido de quantidade exata é instrução, não
    // garantia — o modelo já devolveu 22 e 24 quando o prompt pedia "no mínimo 20".
    // Cortar pelo fim é seguro porque os temas sugeridos pelo redator vêm PRIMEIRO.
    .slice(0, TOTAL_DE_TEMAS);
}

export async function generateThemes(params: {
  client: Client;
  briefing: Briefing;
  clientKnowledgeContext: string;
  keywords: Keyword[];
  topPerformers?: TopPerformer[];
}): Promise<SuggestedTheme[]> {
  const userMessage = buildUserMessage({
    clientInfo: formatClientInfo(params.client),
    clientKnowledgeContext: params.clientKnowledgeContext,
    briefingSummary: formatBriefing(params.briefing),
    keywordsList: formatKeywordsList(params.keywords),
    topPerformers: formatTopPerformers(params.topPerformers ?? []),
  });

  const raw = await askAI(SYSTEM_PROMPT, userMessage);
  return parseThemesResponse(raw);
}
