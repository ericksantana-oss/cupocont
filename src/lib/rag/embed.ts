import os from "os";
import path from "path";
import { env as transformersEnv, pipeline, type FeatureExtractionPipeline } from "@xenova/transformers";

// Por padrão a biblioteca guarda o modelo baixado dentro de node_modules, que na Vercel
// é somente leitura (/var/task) — dava ENOENT a cada chamada e forçava rebaixar os ~30MB
// do modelo sempre. A pasta temporária é gravável e sobrevive entre invocações da mesma
// instância, então o download acontece uma vez por instância em vez de uma por chamada.
transformersEnv.cacheDir = process.env.TRANSFORMERS_CACHE || path.join(os.tmpdir(), "transformers-cache");

// Modelo local (open-source, roda dentro do próprio processo Node via ONNX/WASM).
// Não depende de nenhuma API externa nem de créditos pagos: roda dentro do próprio
// processo Node. O Gemini oferece API de embeddings e trocar por ela removeria esta
// dependência pesada, mas exigiria reprocessar todos os documentos já indexados
// (dimensão do vetor muda, ver vector(384) no schema).
// all-MiniLM-L6-v2 produz vetores de 384 dimensões (ver schema: vector(384)).
const MODEL_NAME = "Xenova/all-MiniLM-L6-v2";
export const EMBEDDING_DIMENSIONS = 384;

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", MODEL_NAME) as Promise<FeatureExtractionPipeline>;
  }
  return extractorPromise;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const extractor = await getExtractor();
  const embeddings: number[][] = [];

  for (const text of texts) {
    // mean pooling + normalização, padrão recomendado para all-MiniLM
    const output = await extractor(text, { pooling: "mean", normalize: true });
    embeddings.push(Array.from(output.data as Float32Array));
  }

  return embeddings;
}

export async function embedText(text: string): Promise<number[]> {
  const [embedding] = await embedTexts([text]);
  return embedding;
}
