import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { extractText, extractTextFromUrl } from "@/lib/rag/extract";
import { chunkText } from "@/lib/rag/chunk";
import { embedTexts } from "@/lib/rag/embed";

// Orquestra o pipeline completo: extração -> chunking -> embeddings -> gravação.
// Chamado depois que o documento já foi salvo em disco (upload) ou o link registrado.
export async function processDocument(
  documentId: string,
  input: { buffer: Buffer; fileType: string } | { url: string }
): Promise<void> {
  try {
    const document = await db.clientDocument.findUniqueOrThrow({ where: { id: documentId } });

    const text =
      "url" in input ? await extractTextFromUrl(input.url) : await extractText(input.buffer, input.fileType);

    const chunks = chunkText(text);
    if (chunks.length === 0) {
      throw new Error("Nenhum conteúdo extraído do documento.");
    }

    const embeddings = await embedTexts(chunks);

    // Insert em lote via raw SQL, pois o tipo `vector` do pgvector não é
    // suportado nativamente pelo Prisma Client (fica marcado como Unsupported).
    for (let i = 0; i < chunks.length; i++) {
      const vectorLiteral = `[${embeddings[i].join(",")}]`;
      await db.$executeRawUnsafe(
        `INSERT INTO document_chunks (id, "documentId", "clientId", content, embedding, "chunkIndex", "createdAt")
         VALUES ($1, $2, $3, $4, '${vectorLiteral}'::vector, $5, now())`,
        randomUUID(),
        documentId,
        document.clientId,
        chunks[i],
        i
      );
    }

    await db.clientDocument.update({
      where: { id: documentId },
      data: { status: "READY" },
    });
  } catch (error) {
    await db.clientDocument.update({
      where: { id: documentId },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Erro desconhecido ao processar documento.",
      },
    });
  }
}
