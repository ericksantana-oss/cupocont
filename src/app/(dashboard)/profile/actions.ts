"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

export type ChangePasswordResult = { error: string } | { success: true };

export async function changePasswordAction(
  _prev: ChangePasswordResult | null,
  formData: FormData
): Promise<ChangePasswordResult> {
  const user = await requireUser();

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "Preencha todos os campos." };
  }

  if (newPassword.length < 8) {
    return { error: "A nova senha precisa ter pelo menos 8 caracteres." };
  }

  if (newPassword !== confirmPassword) {
    return { error: "A confirmação não bate com a nova senha." };
  }

  const fullUser = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  const isValid = await verifyPassword(currentPassword, fullUser.passwordHash);
  if (!isValid) {
    return { error: "Senha atual incorreta." };
  }

  const passwordHash = await hashPassword(newPassword);
  await db.user.update({ where: { id: user.id }, data: { passwordHash } });

  revalidatePath("/profile");
  return { success: true };
}
