import { GoogleGenAI } from "@google/genai";

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Variável de ambiente GEMINI_API_KEY não configurada.");
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

// gemini-3.6-flash e o que o proprio Google indica como atual (o 2.5 responde 404
// apontando pra ele). Evitar "gemini-3.7-flash" e "gemini-flash-latest": ambos aparecem
// na listagem de modelos mas penduram sem responder nem dar erro — testado em 20/08/2026.
export const AI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

// Folgado de propósito: os modelos Gemini 3.x gastam parte da saída "pensando" antes
// de responder, e a geração de 20 temas em JSON é o pedido mais longo da ferramenta.
// Teto baixo aqui trunca o JSON no meio e quebra a leitura da resposta.
const MAX_OUTPUT_TOKENS = 8192;

const MAX_TENTATIVAS = 4;

// Sem isso, uma chamada pendurada trava a acao do redator ate a plataforma matar a
// funcao. Ja vimos modelo que nao responde nem devolve erro, entao nao e hipotetico.
const TIMEOUT_MS = 120_000;

function ehErroTemporario(mensagem: string): boolean {
  // 429 = estourou o limite de chamadas por minuto (comum no plano gratuito, que
  // permite poucas por minuto); 5xx = instabilidade do lado do Google.
  return /\b(429|500|502|503|504)\b|RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded|rate limit|abort/i.test(mensagem);
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Chama o modelo e devolve o texto puro da resposta. Mensagem única (system + user),
// sem streaming — suficiente porque o resultado é consumido de uma vez, não token a token.
export async function askAI(system: string, userMessage: string): Promise<string> {
  let ultimoErro: unknown;

  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    try {
      const controle = new AbortController();
      const relogio = setTimeout(() => controle.abort(), TIMEOUT_MS);

      let response;
      try {
        response = await getClient().models.generateContent({
          model: AI_MODEL,
          contents: userMessage,
          config: {
            systemInstruction: system,
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            abortSignal: controle.signal,
          },
        });
      } finally {
        clearTimeout(relogio);
      }

      const text = response.text;
      if (text && text.trim().length > 0) return text;

      // Resposta vazia tem causa: cortada no limite de tokens ou barrada por filtro de
      // conteúdo. Sem isso, o erro só aparece depois, como falha de leitura do JSON.
      const motivo = response.candidates?.[0]?.finishReason ?? "desconhecido";
      throw new Error(`A IA retornou resposta vazia (motivo: ${motivo}).`);
    } catch (err) {
      ultimoErro = err;
      const mensagem = err instanceof Error ? err.message : String(err);

      if (tentativa < MAX_TENTATIVAS && ehErroTemporario(mensagem)) {
        // A cota do plano gratuito é por minuto, então esperar 2s não resolve:
        // precisa dar tempo da janela virar.
        await espera(5000 * 3 ** (tentativa - 1)); // 5s, 15s, 45s
        continue;
      }
      break;
    }
  }

  const mensagem = ultimoErro instanceof Error ? ultimoErro.message : String(ultimoErro);
  throw new Error(`Falha ao gerar conteúdo com a IA: ${mensagem}`);
}
