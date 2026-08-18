import type { Keyword, KeywordProvider } from "./provider";

const TREND_OPTIONS: Keyword["trend"][] = ["up", "stable", "down"];

// Implementação mock enquanto nenhuma API de SEO/tendências real está conectada.
// Gera termos plausíveis combinando o nicho do cliente com modificadores comuns
// de busca. Troque por uma implementação real (Google Trends, SEMrush, Ubersuggest...)
// implementando a interface KeywordProvider e ajustando KEYWORDS_PROVIDER no .env.
const MODIFIERS = [
  "como",
  "o que é",
  "melhor",
  "guia de",
  "dicas de",
  "tendências de",
  "preço de",
  "onde comprar",
  "benefícios de",
  "erros ao",
  "passo a passo",
  "para iniciantes",
  "comparativo de",
  "review de",
  "vale a pena",
];

function seededRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return () => {
    h = (h * 1103515245 + 12345) >>> 0;
    return h / 0xffffffff;
  };
}

export class MockKeywordProvider implements KeywordProvider {
  async fetchKeywords(niche: string, period: string): Promise<Keyword[]> {
    const rand = seededRandom(`${niche}-${period}`);

    return MODIFIERS.map((modifier) => {
      const term = `${modifier} ${niche}`.toLowerCase();
      const volume = Math.round(500 + rand() * 9500);
      const trend = TREND_OPTIONS[Math.floor(rand() * TREND_OPTIONS.length)];
      return { term, volume, trend };
    }).sort((a, b) => b.volume - a.volume);
  }
}
