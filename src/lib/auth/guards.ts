import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/clients");
  return user;
}

// Admins e estagiários (acesso total) veem qualquer cliente. Redatores só veem
// clientes do próprio squad, mais os que foram liberados pontualmente via ClientAccess.
export async function requireClientAccess(clientId: string): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role === "ADMIN" || user.role === "INTERN") return user;

  const client = await db.client.findUnique({ where: { id: clientId }, select: { squadId: true } });
  if (client?.squadId && user.squadId && client.squadId === user.squadId) return user;

  const access = await db.clientAccess.findUnique({
    where: { userId_clientId: { userId: user.id, clientId } },
  });

  if (!access) redirect("/clients");
  return user;
}
