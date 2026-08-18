import { askClaude } from "@/lib/ai/claude";
import { formatBriefing, formatClientInfo } from "@/lib/ai/contextBuilder";
import type { Briefing, Client, ContentTheme } from "@prisma/client";

const SYSTEM_PROMPT = `Você é redator de conteúdo para redes sociais de uma agência, escrevendo em nome de UM cliente específico.

Regra mais importante: o texto final deve seguir RIGOROSAMENTE o tom de voz, linguagem, personas e glossário de
termos permitidos/proibidos descritos no "Contexto do cliente" abaixo — essa é a fonte da verdade sobre como
o cliente se comunica, não é apenas mais um dado do pedido. Se o contexto do cliente conflitar com uma prática
genérica de redação para redes sociais, o contexto do cliente vence.

Respeite também as restrições do briefing do mês (ex: não mencionar concorrentes, não fazer promessas de resultado).

Escreva o texto final do post (pronto para publicar), sem comentários extras, sem markdown, sem explicações
sobre o que você fez — apenas o texto do post.`;

export async function generateThemeText(params: {
  client: Client;
  briefing: Briefing;
  theme: ContentTheme;
  clientKnowledgeContext: string;
  previousVersion?: string;
  regenerationInstructions?: string;
}): Promise<string> {
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
    parts.push(
      ``,
      `## Versão anterior do texto (para refinar, não repetir igual)`,
      params.previousVersion
    );
  }

  if (params.regenerationInstructions) {
    parts.push(``, `## Instruções adicionais do redator para esta regeneração`, params.regenerationInstructions);
  }

  parts.push(``, `Escreva agora o texto final do post para este tema.`);

  return askClaude(SYSTEM_PROMPT, parts.join("\n"));
}
