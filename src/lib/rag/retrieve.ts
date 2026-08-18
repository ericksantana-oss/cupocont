import { db } from "@/lib/db";
import { embedText } from "@/lib/rag/embed";

function toVectorLiteral(embedding: number[]): string {
  // Os valores vêm direto da API de embeddings (nunca de input do usuário),
  // mas validamos que são números finitos antes de interpolar no SQL.
  const values = embedding.map((n) => {
    if (!Number.isFinite(n)) throw new Error("Embedding inválido.");
    return n;
  });
  return `[${values.join(",")}]`;
}

export type RetrievedChunk = {
  id: string;
  content: string;
  similarity: number;
};

// Busca semântica: retorna os chunks mais relevantes de um cliente para uma
// query (ex: o briefing do mês), usados como contexto no prompt da IA.
export async function retrieveRelevantChunks(
  clientId: string,
  query: string,
  topK = 8
): Promise<RetrievedChunk[]> {
  const queryEmbedding = await embedText(query);
  const vectorLiteral = toVectorLiteral(queryEmbedding);

  const rows = await db.$queryRawUnsafe<RetrievedChunk[]>(
    `SELECT id, content, 1 - (embedding <=> '${vectorLiteral}'::vector) AS similarity
     FROM document_chunks
     WHERE "clientId" = $1 AND embedding IS NOT NULL
     ORDER BY embedding <=> '${vectorLiteral}'::vector
     LIMIT $2`,
    clientId,
    topK
  );

  return rows;
}
