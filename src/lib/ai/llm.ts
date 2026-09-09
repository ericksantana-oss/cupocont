import Anthropic from "@anthropic-ai/sdk";

// Porta única de entrada da IA na ferramenta. Toda geração — temas, textos, e-mails e a
// leitura do dashboard — passa por askAI(). É por isso que trocar de provedor mexe só
// neste arquivo: já foi Anthropic, virou Gemini em 25/08/2026 e voltou em 09/09/2026.
// Ver docs/decisoes.txt.

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    // O SDK lê ANTHROPIC_API_KEY do ambiente sozinho. A checagem explícita existe para o
    // erro dizer o que fazer, em vez de estourar um 401 genérico na cara do redator.
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("Variável de ambiente ANTHROPIC_API_KEY não configurada.");
    }
    // maxRetries: 0 é obrigatório aqui. O SDK repete sozinho 2 vezes por padrão, e como
    // este arquivo tem o próprio laço de retentativas, as duas camadas se MULTIPLICAM:
    // medido em 09/09/2026, uma chamada que leva 35s levou 805s por causa disso. O laço
    // daqui fica porque ele sabe distinguir erro que melhora esperando de erro que não.
    client = new Anthropic({ maxRetries: 0 });
  }
  return client;
}

// Escolhido em 09/09/2026 pelo Erick, depois de medir os dois: o Sonnet 5 custa cerca de
// um terço do Opus 5 na operação de 25 clientes. Trocar de volta é só a variável de
// ambiente — os números medidos estão em docs/decisoes.txt.
export const AI_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5";

// Esforço de raciocínio. "high" é o padrão da API e o ponto de equilíbrio para conteúdo
// editorial; "medium" e "low" existem como alívio de custo e de tempo, se preciso.
// Configurável por ambiente porque custo e o limite de 60s da Vercel são preocupações
// vivas neste projeto (ver docs/pendencias.txt).
const AI_EFFORT = process.env.CLAUDE_EFFORT || "high";

// Folgado de propósito: a geração de 20 temas em JSON é o pedido mais longo da
// ferramenta, e com raciocínio ligado os tokens de pensamento também contam aqui. Teto
// baixo trunca o JSON no meio e quebra a leitura da resposta.
const MAX_OUTPUT_TOKENS = 16_000;

const MAX_TENTATIVAS = 4;

// Orçamento TOTAL de tempo, não por tentativa. Menor que o limite da plataforma de
// propósito: na Vercel Hobby a função morre em 60s e devolve um 504 sem explicação;
// estourando antes, o redator recebe uma mensagem que diz o que aconteceu.
//
// Ser total, e não por tentativa, é o que impede o laço de prometer o que a plataforma
// não deixa cumprir. Medido em 09/09/2026: uma geração de 20 temas leva ~35s, então
// dentro de 55s não cabe uma segunda tentativa longa — e o laço respeita isso em vez de
// tentar e ser morto no meio. Retentativa aqui serve para falha RÁPIDA (429 ou 5xx que
// voltam em segundos), que é justamente quando ela ajuda.
const ORCAMENTO_MS = Number(process.env.CLAUDE_TIMEOUT_MS ?? 55_000);

// Abaixo disto não vale tentar de novo: a chamada seria morta antes de responder.
const MINIMO_PARA_TENTAR_MS = 12_000;

// ---------------------------------------------------------------------------
// Classificação de erro: o que vale reesperar e o que não vale.
//
// A distinção não é estética. Insistir num erro permanente queima mais de um minuto do
// redator para falhar igual no fim — foi a lição que a cota diária do Gemini ensinou.

// O SDK diz "Request timed out" — sem o "timed out" aqui a mensagem amigável não
// aparece e o redator recebe o erro cru. Foi o que aconteceu no primeiro teste.
const PADRAO_DE_TIMEOUT = /abort|timed out|timeout|ECONNRESET|ETIMEDOUT/i;

function ehSemSaldo(mensagem: string): boolean {
  return /credit balance|billing|insufficient|quota/i.test(mensagem);
}

function ehErroTemporario(err: unknown): boolean {
  if (err instanceof Anthropic.RateLimitError) return true;
  if (err instanceof Anthropic.APIConnectionError) return true;
  if (err instanceof Anthropic.APIError && typeof err.status === "number" && err.status >= 500) {
    return true;
  }
  const mensagem = err instanceof Error ? err.message : String(err);
  // Timeout do nosso AbortController: a chamada seguinte pode pegar o modelo menos
  // ocupado. Não confundir com sem saldo, que nunca melhora esperando.
  if (ehSemSaldo(mensagem)) return false;
  return PADRAO_DE_TIMEOUT.test(mensagem);
}

// Traduz o erro cru para algo que o redator entenda e saiba o que fazer.
function mensagemParaOUsuario(err: unknown): string {
  const bruto = err instanceof Error ? err.message : String(err);

  if (err instanceof Anthropic.AuthenticationError) {
    return "A chave da API da Anthropic foi recusada. Um admin precisa conferir ANTHROPIC_API_KEY.";
  }
  if (ehSemSaldo(bruto)) {
    return "A conta da Anthropic está sem saldo. É preciso adicionar crédito no console da Anthropic para a IA voltar a funcionar.";
  }
  if (err instanceof Anthropic.RateLimitError) {
    return "A IA recusou por limite de chamadas. Espere um minuto e tente de novo.";
  }
  if (PADRAO_DE_TIMEOUT.test(bruto)) {
    return "A IA não respondeu no tempo esperado. Tente de novo — se repetir, avise um admin.";
  }
  return `Falha ao gerar conteúdo com a IA: ${bruto}`;
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------

// Chama o modelo e devolve o texto puro da resposta. Mensagem única (system + user), sem
// streaming — suficiente porque o resultado é consumido de uma vez, não token a token.
export async function askAI(system: string, userMessage: string): Promise<string> {
  let ultimoErro: unknown;
  const prazo = Date.now() + ORCAMENTO_MS;
  const restante = () => prazo - Date.now();

  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    try {
      const resposta = await getClient().messages.create(
        {
          model: AI_MODEL,
          max_tokens: MAX_OUTPUT_TOKENS,
          // Raciocínio adaptativo: o modelo decide quanto pensar. A profundidade é
          // controlada por effort, não por um teto fixo de tokens de pensamento.
          thinking: { type: "adaptive" },
          output_config: { effort: AI_EFFORT as "low" | "medium" | "high" | "xhigh" | "max" },
          // SEM cache_control aqui, de propósito. Eu tinha colocado achando que cachearia
          // o contexto do cliente, e MEDI que não: o system destes prompts tem 778 tokens,
          // abaixo do mínimo cacheável do modelo — o cache era ignorado em silêncio. E os
          // ~8.000 tokens que valeriam cache (contexto do cliente, regras fixas, feedback)
          // não estão aqui: vão dentro da mensagem do usuário, montados por
          // buildUserMessage. Cachear de verdade exige mover esse bloco para cá, o que
          // muda a estrutura do prompt e mexe com qualidade. Ver docs/pendencias.txt.
          system,
          messages: [{ role: "user", content: userMessage }],
        },
        { timeout: restante() }
      );

      // stop_reason antes de content, sempre: uma recusa vem com HTTP 200 e conteúdo
      // vazio, e ler o texto direto transformaria isso num erro de JSON confuso.
      if (resposta.stop_reason === "refusal") {
        const categoria = resposta.stop_details?.category ?? "não informada";
        throw new Error(
          `A IA recusou atender a este pedido (categoria: ${categoria}). Revise o briefing e o contexto do cliente.`
        );
      }

      if (resposta.stop_reason === "max_tokens") {
        throw new Error(
          "A resposta da IA foi cortada por tamanho antes de terminar. Gere de novo; se repetir, o pedido precisa ser dividido."
        );
      }

      const texto = resposta.content
        .filter((bloco): bloco is Anthropic.TextBlock => bloco.type === "text")
        .map((bloco) => bloco.text)
        .join("");

      if (texto.trim().length > 0) return texto;

      throw new Error(`A IA retornou resposta vazia (motivo: ${resposta.stop_reason ?? "desconhecido"}).`);
    } catch (err) {
      ultimoErro = err;

      const pausa = 5000 * 3 ** (tentativa - 1); // 5s, 15s, 45s
      const cabeNoOrcamento = restante() - pausa > MINIMO_PARA_TENTAR_MS;

      if (tentativa < MAX_TENTATIVAS && ehErroTemporario(err) && cabeNoOrcamento) {
        await espera(pausa);
        continue;
      }
      break;
    }
  }

  throw new Error(mensagemParaOUsuario(ultimoErro));
}
