"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { hashPassword } from "@/lib/auth/password";
import type { Role } from "@prisma/client";

export async function createUserAction(formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "WRITER") as Role;

  if (!name || !email || !password) {
    throw new Error("Nome, email e senha são obrigatórios.");
  }

  const passwordHash = await hashPassword(password);
  await db.user.create({ data: { name, email, passwordHash, role } });

  revalidatePath("/users");
}

// Liga/desliga o acesso de um redator a um cliente específico
export async function toggleClientAccessAction(formData: FormData) {
  await requireAdmin();

  const userId = String(formData.get("userId"));
  const clientId = String(formData.get("clientId"));
  const shouldHaveAccess = formData.get("grant") === "true";

  if (shouldHaveAccess) {
    await db.clientAccess.upsert({
      where: { userId_clientId: { userId, clientId } },
      create: { userId, clientId },
      update: {},
    });
  } else {
    await db.clientAccess.deleteMany({ where: { userId, clientId } });
  }

  revalidatePath("/users");
}
