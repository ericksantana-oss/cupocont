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

// Cuidado ao trocar de modelo — testado em 25/08/2026 nesta chave:
//   gemini-3.7-flash e gemini-flash-latest: aparecem na listagem de modelos mas PENDURAM,
//     sem responder nem devolver erro.
//   gemini-2.5-flash: responde 404 para chaves novas.
//   gemini-3.6-flash: funciona, mas a cota gratuita é de apenas 20 chamadas por DIA — não
//     cobre nem um mês de um cliente, que consome 24.
// Cota gratuita maior costuma estar nos modelos de geração anterior e nos "lite".
export const AI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";

// Folgado de propósito: os modelos Gemini 3.x gastam parte da saída "pensando" antes
// de responder, e a geração de 20 temas em JSON é o pedido mais longo da ferramenta.
// Teto baixo aqui trunca o JSON no meio e quebra a leitura da resposta.
const MAX_OUTPUT_TOKENS = 8192;

const MAX_TENTATIVAS = 4;

// Sem isso, uma chamada pendurada trava a ação do redator até a plataforma matar a
// função. Já vimos modelo que não responde nem devolve erro, então não é hipotético.
const TIMEOUT_MS = 120_000;

// Cota diária esgotada não melhora com espera: insistir só queima mais de um minuto
// antes de falhar igual. Vale distinguir para avisar o redator do que está acontecendo.
function ehCotaDiariaEsgotada(mensagem: string): boolean {
  return /PerDay|RequestsPerDay|per day/i.test(mensagem);
}

function ehLimitePorMinuto(mensagem: string): boolean {
  return /\b429\b|RESOURCE_EXHAUSTED|rate limit/i.test(mensagem);
}

function ehErroTemporario(mensagem: string): boolean {
  if (ehCotaDiariaEsgotada(mensagem)) return false;
  // 429 por minuto: a janela vira em segundos, vale esperar. 5xx: instabilidade do Google.
  return /\b(500|502|503|504)\b|UNAVAILABLE|overloaded|abort/i.test(mensagem) || ehLimitePorMinuto(mensagem);
}

// Traduz o erro cru da API para algo que o redator entenda e saiba o que fazer.
function mensagemParaOUsuario(bruto: string): string {
  if (ehCotaDiariaEsgotada(bruto)) {
    return "A cota diária gratuita da IA acabou. Ela é renovada no dia seguinte — ou o plano pago do Gemini remove esse limite.";
  }
  if (ehLimitePorMinuto(bruto)) {
    return "A IA recusou por limite de chamadas por minuto. Espere um minuto e tente de novo.";
  }
  if (/abort/i.test(bruto)) {
    return "A IA não respondeu no tempo esperado. Tente de novo.";
  }
  return `Falha ao gerar conteúdo com a IA: ${bruto}`;
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
        // A cota por minuto do plano gratuito é curta: esperar 2s não resolve, precisa
        // dar tempo da janela virar.
        await espera(5000 * 3 ** (tentativa - 1)); // 5s, 15s, 45s
        continue;
      }
      break;
    }
  }

  const mensagem = ultimoErro instanceof Error ? ultimoErro.message : String(ultimoErro);
  throw new Error(mensagemParaOUsuario(mensagem));
}
