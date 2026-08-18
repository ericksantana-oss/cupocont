import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getClaudeClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

export const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-5";

// Chama Claude e retorna o texto puro da resposta. Uso simples de mensagem
// única (system + user), sem streaming — suficiente para geração de
// temas/textos que são consumidos de uma vez, não token a token.
export async function askClaude(system: string, userMessage: string): Promise<string> {
  const response = await getClaudeClient().messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock?.type === "text" ? textBlock.text : "";
}
