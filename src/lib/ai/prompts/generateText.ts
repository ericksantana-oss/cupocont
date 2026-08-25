import { askClaude } from "@/lib/ai/claude";
import { formatBriefing, formatClientInfo } from "@/lib/ai/contextBuilder";
import {
  CARD_IMAGE_TEXT_LIMIT,
  MAX_SLIDES,
  SLIDE_LIMITS,
  normalizeSlideRoles,
  type PieceFormat,
  type Slide,
} from "@/lib/contentPiece";
import type { Briefing, Client, ContentTheme } from "@prisma/client";

const BASE_RULES = `Você é redator de conteúdo para redes sociais de uma agência, escrevendo em nome de UM cliente específico.

Regra mais importante: o texto final deve seguir RIGOROSAMENTE o tom de voz, linguagem, personas e glossário de
termos permitidos/proibidos descritos no "Contexto do cliente" abaixo — essa é a fonte da verdade sobre como
o cliente se comunica. Se o contexto do cliente conflitar com uma prática genérica de redação para redes sociais,
o contexto do cliente vence.

Respeite também as restrições do briefing do mês (ex: não mencionar concorrentes, não fazer promessas de resultado).

Nunca use markdown, asteriscos ou títulos. Texto puro, pronto para publicar.`;

const CARD_SYSTEM = `${BASE_RULES}

Esta peça é um CARD: uma imagem única com um texto curto na arte, mais a legenda do post.

Responda APENAS com um JSON válido (sem markdown, sem texto antes ou depois):
{"legenda": "...", "textoImagem": "..."}

- "legenda": a legenda completa do post, pronta para publicar.
- "textoImagem": o texto que vai DENTRO da arte. No máximo ${CARD_IMAGE_TEXT_LIMIT} caracteres, contando espaços.
  É uma manchete: precisa parar o rolar do dedo por si só, sem depender da legenda.`;

const CARROSSEL_SYSTEM = `${BASE_RULES}

Esta peça é um CARROSSEL: uma sequência de cards com texto na arte, mais a legenda do post.

Você decide quantos cards o tema pede, no mínimo 3 e no máximo ${MAX_SLIDES}, contando capa e CTA.
Use só o necessário: carrossel inflado com card vazio de conteúdo é pior que carrossel curto.

Estrutura obrigatória: o PRIMEIRO card é a capa e o ÚLTIMO é o CTA.

Responda APENAS com um JSON válido (sem markdown, sem texto antes ou depois):
{"legenda": "...", "cards": [{"tipo": "capa", "texto": "..."}, {"tipo": "interno", "texto": "..."}, {"tipo": "cta", "texto": "..."}]}

Limites de caracteres, contando espaços — respeite com folga, não chegue no limite:
- capa: máximo ${SLIDE_LIMITS.CAPA} caracteres. É a manchete que decide se a pessoa desliza ou não.
- interno: máximo ${SLIDE_LIMITS.INTERNO} caracteres cada. Uma ideia por card, que se sustente sozinha.
- cta: máximo ${SLIDE_LIMITS.CTA} caracteres. Uma chamada de ação curta e direta.`;

export type GeneratedPiece = {
  caption: string;
  imageText: string | null;
  slides: Slide[];
};

function buildUserMessage(params: {
  client: Client;
  briefing: Briefing;
  theme: ContentTheme;
  clientKnowledgeContext: string;
  previousVersion?: string;
  regenerationInstructions?: string;
}): string {
  const parts = [
    `## Contexto do cliente (base de conhecimento)`,
    params.clientKnowledgeContext,
    ``,
    `## ${formatClientInfo(params.client)}`,
    ``,
    `## Briefing do mês`,
    formatBriefing(params.briefing),
    ``,
    `## Tema selecionado`,
    `Título: ${params.theme.title}`,
    `Justificativa: ${params.theme.justification}`,
  ];

  if (params.previousVersion) {
    parts.push(``, `## Versão anterior (para refinar, não repetir igual)`, params.previousVersion);
  }

  if (params.regenerationInstructions) {
    parts.push(``, `## Instruções adicionais do redator para esta regeneração`, params.regenerationInstructions);
  }

  parts.push(``, `Escreva agora a peça para este tema, no formato JSON pedido.`);
  return parts.join("\n");
}

function extractJson(raw: string): unknown {
  const match = raw.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : raw);
}

function parseCard(raw: string): GeneratedPiece {
  const parsed = extractJson(raw) as { legenda?: unknown; textoImagem?: unknown };
  return {
    caption: typeof parsed.legenda === "string" ? parsed.legenda.trim() : "",
    imageText: typeof parsed.textoImagem === "string" ? parsed.textoImagem.trim() : null,
    slides: [],
  };
}

function parseCarrossel(raw: string): GeneratedPiece {
  const parsed = extractJson(raw) as { legenda?: unknown; cards?: unknown };
  const cards = Array.isArray(parsed.cards) ? parsed.cards : [];

  const slides: Slide[] = cards
    .filter((c): c is { texto: string } => !!c && typeof (c as { texto?: unknown }).texto === "string")
    .map((c) => ({ role: "INTERNO" as const, text: c.texto.trim() }))
    .filter((s) => s.text.length > 0)
    .slice(0, MAX_SLIDES);

  return {
    caption: typeof parsed.legenda === "string" ? parsed.legenda.trim() : "",
    imageText: null,
    // Os papéis vêm da posição, não do que a IA disse — garante capa no início e CTA no fim
    // mesmo que ela devolva os rótulos trocados ou fora de ordem.
    slides: normalizeSlideRoles(slides),
  };
}

export async function generateThemePiece(params: {
  client: Client;
  briefing: Briefing;
  theme: ContentTheme;
  clientKnowledgeContext: string;
  pieceFormat: PieceFormat;
  previousVersion?: string;
  regenerationInstructions?: string;
}): Promise<GeneratedPiece> {
  const system = params.pieceFormat === "CARD" ? CARD_SYSTEM : CARROSSEL_SYSTEM;
  const raw = await askClaude(system, buildUserMessage(params));

  return params.pieceFormat === "CARD" ? parseCard(raw) : parseCarrossel(raw);
}
