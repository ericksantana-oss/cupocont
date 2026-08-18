import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createUserAction, toggleClientAccessAction } from "./actions";

export default async function UsersPage() {
  await requireAdmin();

  const [users, clients] = await Promise.all([
    db.user.findMany({
      orderBy: { createdAt: "asc" },
      include: { clientAccess: { select: { clientId: true } } },
    }),
    db.client.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-10">
      <div>
        <h1 className="display text-3xl">Novo usuário</h1>
        <form action={createUserAction} className="cartao mt-6 grid max-w-2xl grid-cols-2 gap-3 p-6">
          <Input name="name" placeholder="Nome" required />
          <Input name="email" type="email" placeholder="Email" required />
          <Input name="password" type="password" placeholder="Senha inicial" required />
          <select name="role" className="rounded-controle border border-linha bg-carta px-3 py-1 text-sm shadow-carta">
            <option value="WRITER">Redator</option>
            <option value="ADMIN">Admin</option>
          </select>
          <Button type="submit" className="col-span-2">
            Criar usuário
          </Button>
        </form>
      </div>

      <div>
        <h2 className="rotulo">Usuários e acesso a clientes</h2>
        <div className="cartao mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-linha bg-linha-2 text-left">
              <tr>
                <th className="p-3">Nome</th>
                <th className="p-3">Papel</th>
                {clients.map((client) => (
                  <th key={client.id} className="p-3 whitespace-nowrap">
                    {client.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const accessSet = new Set(user.clientAccess.map((a) => a.clientId));
                return (
                  <tr key={user.id} className="border-b border-linha-2">
                    <td className="p-3">
                      {user.name}
                      <br />
                      <span className="text-xs text-tinta-3">{user.email}</span>
                    </td>
                    <td className="p-3">{user.role === "ADMIN" ? "Admin" : "Redator"}</td>
                    {clients.map((client) => {
                      const hasAccess = accessSet.has(client.id);
                      return (
                        <td key={client.id} className="p-3 text-center">
                          {user.role === "ADMIN" ? (
                            <span className="text-xs text-tinta-3">todos</span>
                          ) : (
                            <form action={toggleClientAccessAction}>
                              <input type="hidden" name="userId" value={user.id} />
                              <input type="hidden" name="clientId" value={client.id} />
                              <input type="hidden" name="grant" value={(!hasAccess).toString()} />
                              <button
                                type="submit"
                                className={
                                  hasAccess
                                    ? "rounded-controle bg-salvia/20 px-2 py-1 text-mata"
                                    : "rounded-controle bg-linha-2 px-2 py-1 text-tinta-3"
                                }
                              >
                                {hasAccess ? "✓" : "—"}
                              </button>
                            </form>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
