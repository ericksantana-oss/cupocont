-- Troca de provedor de embeddings (OpenAI text-embedding-3-small, 1536 dims)
-- para modelo local all-MiniLM-L6-v2 (384 dims), evitando dependência de API paga.
DROP INDEX IF EXISTS "document_chunks_embedding_idx";

-- pgvector não converte entre dimensões diferentes; como a tabela está vazia
-- neste ponto do projeto, é seguro recriar a coluna em vez de tentar um cast.
ALTER TABLE "document_chunks" DROP COLUMN "embedding";
ALTER TABLE "document_chunks" ADD COLUMN "embedding" vector(384);

CREATE INDEX "document_chunks_embedding_idx" ON "document_chunks" USING hnsw ("embedding" vector_cosine_ops);
