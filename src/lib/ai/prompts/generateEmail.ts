import { askAI } from "@/lib/ai/llm";
import { formatClientInfo } from "@/lib/ai/contextBuilder";
import type { Client } from "@prisma/client";

const BASE_RULES = `Você é redator de e-mail marketing da agência Cupola, escrevendo em nome de UM cliente específico.

Regra mais importante: siga RIGOROSAMENTE o tom de voz, linguagem e posicionamento descritos no "Contexto do
cliente" abaixo — é a fonte da verdade sobre como o cliente se comunica. Não invente informações factuais
(preços, datas, características de produto) que não estejam no contexto ou no direcionamento do redator.

Regras de linguagem:
- Português do Brasil, direto.
- Se for e-mail de boas-vindas, use "Boas-vindas" — nunca "Bem-vindo(a)" (linguagem neutra).
- Nunca use markdown, headers ou asteriscos — texto puro, pronto para e-mail.`;

export type FlowEmailSummary = { name: string; subjectA: string | null; body: string | null };

function formatFlowHistory(previousEmails: FlowEmailSummary[]): string {
  if (previousEmails.length === 0) return "Este é o primeiro e-mail do fluxo.";
  return previousEmails
    .map(
      (email, i) =>
        `[E-mail ${i + 1} do fluxo: "${email.name}"]\nAssunto: ${email.subjectA ?? "-"}\n${email.body ?? "(sem corpo)"}`
    )
    .join("\n\n");
}

type GenerationContext = {
  client: Client;
  clientKnowledgeContext: string;
  briefing: string; // contexto/mini-briefing livre do redator
  flowHistory?: FlowEmailSummary[]; // e-mails anteriores do mesmo fluxo, se houver
};

function buildContextBlock(params: GenerationContext): string {
  const parts = [
    `## ${formatClientInfo(params.client)}`,
    ``,
    `## Contexto do cliente (base de conhecimento)`,
    params.clientKnowledgeContext,
    ``,
    `## Direcionamento do redator para este e-mail`,
    params.briefing,
  ];

  if (params.flowHistory) {
    parts.push(``, `## E-mails anteriores deste fluxo (para manter continuidade e não repetir gancho)`, formatFlowHistory(params.flowHistory));
  }

  return parts.join("\n");
}

export type GeneratedBody = { hasCard: boolean; cardText: string | null; body: string };

function parseBodyResponse(raw: string): GeneratedBody {
  const cardMatch = raw.match(/CARD:\s*(.*)/i);
  const bodyMatch = raw.match(/CORPO:\s*([\s\S]*)/i);

  const cardValue = cardMatch?.[1]?.trim() ?? "nenhum";
  const hasCard = cardValue.toLowerCase() !== "nenhum" && cardValue.length > 0;

  return {
    hasCard,
    cardText: hasCard ? cardValue : null,
    body: (bodyMatch?.[1] ?? raw).trim(),
  };
}

export async function generateEmailBody(ctx: GenerationContext): Promise<GeneratedBody> {
  const system = `${BASE_RULES}

Escreva o corpo do e-mail desenvolvendo o direcionamento do redator. Comece sempre com a saudação
"Olá, |PRIMEIRO_NOME|. Tudo bem?" antes de entrar no conteúdo.

Decida se faz sentido um bloco de destaque (card) resumindo uma oferta/produto específico — use com
moderação, só quando reforça a mensagem.

Responda EXATAMENTE neste formato (sem markdown):
CARD: <texto curto do card, ou a palavra "nenhum" se não fizer sentido>
CORPO:
<corpo completo do e-mail, incluindo a saudação>`;

  const raw = await askAI(system, buildContextBlock(ctx));
  return parseBodyResponse(raw);
}

export type GeneratedSubjects = { subjectA: string; subjectB: string };

function parseSubjects(raw: string): GeneratedSubjects {
  const aMatch = raw.match(/A:\s*(.+)/i);
  const bMatch = raw.match(/B:\s*(.+)/i);
  return {
    subjectA: (aMatch?.[1] ?? raw.split("\n")[0] ?? "").trim().slice(0, 50),
    subjectB: (bMatch?.[1] ?? raw.split("\n")[1] ?? "").trim().slice(0, 50),
  };
}

export async function generateEmailSubjects(ctx: GenerationContext & { body: string }): Promise<GeneratedSubjects> {
  const system = `${BASE_RULES}

Escreva dois assuntos de e-mail para teste A/B, com ABORDAGENS DIFERENTES entre si (ex: um mais direto,
outro mais curioso/emocional). Máximo de 50 caracteres cada.

Responda EXATAMENTE neste formato:
A: <assunto A>
B: <assunto B>`;

  const raw = await askAI(system, `${buildContextBlock(ctx)}\n\n## Corpo já escrito do e-mail\n${ctx.body}`);
  return parseSubjects(raw);
}

export async function generateEmailPreheader(ctx: GenerationContext & { body: string }): Promise<string> {
  const system = `${BASE_RULES}

Escreva o preheader (texto de prévia que aparece ao lado do assunto na caixa de entrada). Máximo de 40
caracteres. Responda APENAS com o texto do preheader, nada mais.`;

  const raw = await askAI(system, `${buildContextBlock(ctx)}\n\n## Corpo já escrito do e-mail\n${ctx.body}`);
  return raw.trim().slice(0, 40);
}

export async function generateEmailCta(ctx: GenerationContext & { body: string }): Promise<string> {
  const system = `${BASE_RULES}

Escreva SOMENTE o texto do botão de CTA (call to action) deste e-mail — curto, no imperativo, coerente
com o corpo. Responda APENAS com o texto do botão, sem explicações.`;

  const raw = await askAI(system, `${buildContextBlock(ctx)}\n\n## Corpo já escrito do e-mail\n${ctx.body}`);
  return raw.trim().replace(/^["']|["']$/g, "");
}

async function generateEmailFarewell(ctx: GenerationContext): Promise<string> {
  const system = `${BASE_RULES}

Escreva uma frase curta de despedida para fechar o e-mail (antes da assinatura), coerente com o tom de
voz do cliente. Responda APENAS com a frase de despedida.`;

  const raw = await askAI(system, buildContextBlock(ctx));
  return raw.trim();
}

export type GeneratedEmail = GeneratedBody & GeneratedSubjects & { preheader: string; ctaText: string; farewell: string };

// Geração completa: usada na criação do e-mail e no "regenerar e-mail inteiro".
export async function generateFullEmail(ctx: GenerationContext): Promise<GeneratedEmail> {
  const bodyResult = await generateEmailBody(ctx);
  const [subjects, preheader, ctaText, farewell] = await Promise.all([
    generateEmailSubjects({ ...ctx, body: bodyResult.body }),
    generateEmailPreheader({ ...ctx, body: bodyResult.body }),
    generateEmailCta({ ...ctx, body: bodyResult.body }),
    generateEmailFarewell(ctx),
  ]);

  return { ...bodyResult, ...subjects, preheader, ctaText, farewell };
}
