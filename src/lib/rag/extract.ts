import pdfParse from "pdf-parse";
import mammoth from "mammoth";

// Extrai texto puro de um arquivo, de acordo com o tipo. É o primeiro passo do
// pipeline de RAG: documento bruto -> texto -> chunks -> embeddings.
export async function extractText(buffer: Buffer, fileType: string): Promise<string> {
  switch (fileType) {
    case "pdf": {
      const result = await pdfParse(buffer);
      return result.text;
    }
    case "docx": {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    case "txt":
      return buffer.toString("utf-8");
    default:
      throw new Error(`Tipo de arquivo não suportado para extração: ${fileType}`);
  }
}

// Para links de referência: busca a página e remove tags HTML de forma simples.
// Não é um parser HTML completo — suficiente para extrair conteúdo textual de
// páginas de blog/artigo para servir de contexto no RAG.
export async function extractTextFromUrl(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Falha ao buscar URL (${response.status}): ${url}`);
  }
  const html = await response.text();
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
