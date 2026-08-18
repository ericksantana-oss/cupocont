import type { KeywordProvider } from "./provider";
import { MockKeywordProvider } from "./mockProvider";

// Ponto único de troca: quando houver acesso a uma API real de SEO/tendências,
// adicione o provider aqui e mude KEYWORDS_PROVIDER no .env.
export function getKeywordProvider(): KeywordProvider {
  const providerName = process.env.KEYWORDS_PROVIDER ?? "mock";

  switch (providerName) {
    case "mock":
    default:
      return new MockKeywordProvider();
  }
}
