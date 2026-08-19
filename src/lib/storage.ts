import { createClient } from "@supabase/supabase-js";

const DOCUMENTS_BUCKET = "client-documents";
const MEDIA_BUCKET = "post-media";

function getClient() {
  const url = process.env.APP_SUPABASE_URL;
  const serviceRoleKey = process.env.APP_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("APP_SUPABASE_URL/APP_SUPABASE_SERVICE_ROLE_KEY não configurados.");
  return createClient(url, serviceRoleKey);
}

const readyBuckets = new Set<string>();

async function ensureBucket(bucket: string) {
  if (readyBuckets.has(bucket)) return;
  const supabase = getClient();
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.some((b) => b.name === bucket)) {
    await supabase.storage.createBucket(bucket, { public: false });
  }
  readyBuckets.add(bucket);
}

async function uploadFile(bucket: string, objectPath: string, buffer: Buffer, contentType?: string): Promise<string> {
  await ensureBucket(bucket);
  const supabase = getClient();
  const { error } = await supabase.storage.from(bucket).upload(objectPath, buffer, {
    contentType: contentType ?? "application/octet-stream",
    upsert: true,
  });
  if (error) throw new Error(`Falha ao salvar arquivo: ${error.message}`);
  return objectPath;
}

async function deleteFile(bucket: string, objectPath: string): Promise<void> {
  const supabase = getClient();
  await supabase.storage.from(bucket).remove([objectPath]);
}

export function uploadClientFile(objectPath: string, buffer: Buffer, contentType?: string) {
  return uploadFile(DOCUMENTS_BUCKET, objectPath, buffer, contentType);
}

export function deleteClientFile(objectPath: string) {
  return deleteFile(DOCUMENTS_BUCKET, objectPath);
}

export function uploadPostMedia(objectPath: string, buffer: Buffer, contentType?: string) {
  return uploadFile(MEDIA_BUCKET, objectPath, buffer, contentType);
}

export function deletePostMedia(objectPath: string) {
  return deleteFile(MEDIA_BUCKET, objectPath);
}

// Mídia é privada; geramos uma URL assinada só na hora de publicar (a Meta
// exige uma URL pública, mesmo que temporária) ou de exibir prévia na tela.
export async function getPostMediaSignedUrl(objectPath: string, expiresInSeconds = 3600): Promise<string> {
  const supabase = getClient();
  const { data, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(objectPath, expiresInSeconds);
  if (error || !data) throw new Error(`Falha ao gerar URL da mídia: ${error?.message}`);
  return data.signedUrl;
}
