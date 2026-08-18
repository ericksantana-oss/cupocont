export type Keyword = {
  term: string;
  volume: number;
  trend: "up" | "stable" | "down";
};

export interface KeywordProvider {
  fetchKeywords(niche: string, period: string): Promise<Keyword[]>;
}
