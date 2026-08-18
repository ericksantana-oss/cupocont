// Chunking por caracteres (aproximação simples de tokens: ~4 chars/token).
// ~800 tokens por chunk com overlap de ~150 tokens para não cortar contexto
// importante (ex: uma regra de tom de voz) exatamente na borda de dois chunks.
const CHARS_PER_CHUNK = 3200;
const OVERLAP_CHARS = 600;

export function chunkText(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    const end = Math.min(start + CHARS_PER_CHUNK, normalized.length);
    chunks.push(normalized.slice(start, end));
    if (end === normalized.length) break;
    start = end - OVERLAP_CHARS;
  }

  return chunks;
}
