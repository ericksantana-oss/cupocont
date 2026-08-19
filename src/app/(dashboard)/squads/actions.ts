"use server";

import { randomUUID } from "crypto";
import path from "path";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { uploadSquadLogo } from "@/lib/storage";
import { sanitizeForStorageKey } from "@/lib/mediaUpload";

export async function createSquadAction(formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("O nome do squad não pode ficar vazio.");

  const squad = await db.squad.create({ data: { name } });

  const logo = formData.get("logo") as File | null;
  if (logo && logo.size > 0) {
    const objectPath = `${squad.id}/${randomUUID()}-${sanitizeForStorageKey(logo.name)}`;
    const buffer = Buffer.from(await logo.arrayBuffer());
    const ext = path.extname(logo.name).toLowerCase().replace(".", "");
    await uploadSquadLogo(objectPath, buffer, ext === "png" ? "image/png" : "image/jpeg");
    await db.squad.update({ where: { id: squad.id }, data: { logoPath: objectPath } });
  }

  revalidatePath("/squads");
}

export async function updateSquadNameAction(squadId: string, formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("O nome do squad não pode ficar vazio.");

  await db.squad.update({ where: { id: squadId }, data: { name } });
  revalidatePath("/squads");
}

export async function updateSquadLogoAction(squadId: string, formData: FormData) {
  await requireAdmin();

  const logo = formData.get("logo") as File | null;
  if (!logo || logo.size === 0) throw new Error("Selecione uma imagem.");

  const objectPath = `${squadId}/${randomUUID()}-${sanitizeForStorageKey(logo.name)}`;
  const buffer = Buffer.from(await logo.arrayBuffer());
  const ext = path.extname(logo.name).toLowerCase().replace(".", "");
  await uploadSquadLogo(objectPath, buffer, ext === "png" ? "image/png" : "image/jpeg");
  await db.squad.update({ where: { id: squadId }, data: { logoPath: objectPath } });

  revalidatePath("/squads");
}

export async function updateUserSquadAction(formData: FormData) {
  await requireAdmin();

  const userId = String(formData.get("userId"));
  const squadId = String(formData.get("squadId") ?? "").trim() || null;

  await db.user.update({ where: { id: userId }, data: { squadId } });
  revalidatePath("/users");
}
