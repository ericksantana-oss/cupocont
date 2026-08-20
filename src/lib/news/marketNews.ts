import { XMLParser } from "fast-xml-parser";

const FEEDS = [{ source: "Imobi Report", url: "https://imobireport.com.br/feed/" }];

export type FeedItem = {
  guid: string;
  title: string;
  link: string;
  source: string;
  pubDate: Date;
};

const parser = new XMLParser({ ignoreAttributes: true, trimValues: true });

// Busca e normaliza os itens de um feed RSS 2.0 (formato padrão do WordPress).
async function fetchFeed(source: string, url: string): Promise<FeedItem[]> {
  const res = await fetch(url, { headers: { "User-Agent": "CupoCont/1.0 (+https://cupocont.com.br)" } });
  if (!res.ok) throw new Error(`Falha ao buscar feed "${source}": HTTP ${res.status}`);

  const xml = await res.text();
  const parsed = parser.parse(xml);
  const items = parsed?.rss?.channel?.item;
  const list = Array.isArray(items) ? items : items ? [items] : [];

  return list
    .map((item: Record<string, unknown>) => {
      const link = String(item.link ?? "");
      const guid = typeof item.guid === "object" ? String((item.guid as Record<string, unknown>)["#text"] ?? link) : String(item.guid ?? link);
      const pubDate = new Date(String(item.pubDate ?? ""));
      return { guid, title: String(item.title ?? "").trim(), link, source, pubDate };
    })
    .filter((item) => item.guid && item.title && !Number.isNaN(item.pubDate.getTime()));
}

export async function fetchAllMarketNews(): Promise<FeedItem[]> {
  const results = await Promise.allSettled(FEEDS.map((feed) => fetchFeed(feed.source, feed.url)));
  return results.filter((r): r is PromiseFulfilledResult<FeedItem[]> => r.status === "fulfilled").flatMap((r) => r.value);
}
