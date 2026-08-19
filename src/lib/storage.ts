import { createClient } from "@supabase/supabase-js";

const BUCKET = "client-documents";

function getClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados.");
  return createClient(url, serviceRoleKey);
}

let bucketReady = false;

async function ensureBucket() {
  if (bucketReady) return;
  const supabase = getClient();
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.some((b) => b.name === BUCKET)) {
    await supabase.storage.createBucket(BUCKET, { public: false });
  }
  bucketReady = true;
}

export async function uploadClientFile(objectPath: string, buffer: Buffer, contentType?: string): Promise<string> {
  await ensureBucket();
  const supabase = getClient();
  const { error } = await supabase.storage.from(BUCKET).upload(objectPath, buffer, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`Falha ao salvar arquivo: ${error.message}`);
  return objectPath;
}

export async function deleteClientFile(objectPath: string): Promise<void> {
  const supabase = getClient();
  await supabase.storage.from(BUCKET).remove([objectPath]);
}
