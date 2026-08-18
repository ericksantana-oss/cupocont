import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import type { Role } from "@prisma/client";

const COOKIE_NAME = "session_token";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

// Sessão fica no banco (tabela `sessions`); o cookie guarda só um token opaco.
// Isso permite revogar sessões (ex: trocar senha, "sair de todos os dispositivos")
// sem depender de JWT stateless.
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.session.create({
    data: { token, userId, expiresAt },
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role,
  };
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (token) {
    await db.session.deleteMany({ where: { token } });
  }

  cookieStore.delete(COOKIE_NAME);
}
