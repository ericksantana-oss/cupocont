import { pipeline, type FeatureExtractionPipeline } from "@xenova/transformers";

// Modelo local (open-source, roda dentro do próprio processo Node via ONNX/WASM).
// Não depende de nenhuma API externa nem de créditos pagos — a Anthropic não expõe
// API de embeddings, e esse projeto evita um segundo provedor pago (ex: OpenAI/Voyage).
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
