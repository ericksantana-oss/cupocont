import Link from "next/link";
import { Users2 } from "lucide-react";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSquadLogoPublicUrl } from "@/lib/storage";
import { createSquadAction, updateSquadNameAction, updateSquadLogoAction } from "./actions";

export default async function SquadsPage() {
  await requireAdmin();

  const squads = await db.squad.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { clients: true, members: true } } },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-6 py-10">
      <div>
        <h1 className="display text-3xl">Novo squad</h1>
        <form action={createSquadAction} className="cartao mt-6 flex flex-wrap items-center gap-3 p-6">
          <Input name="name" placeholder="Nome do squad" required className="max-w-xs" />
          <input type="file" name="logo" accept="image/jpeg,image/png" className="text-sm" />
          <Button type="submit">Criar squad</Button>
        </form>
      </div>

      <div>
        <h2 className="rotulo">Squads</h2>
        <div className="mt-4 space-y-3">
          {squads.length === 0 && <p className="text-sm text-tinta-3">Nenhum squad criado ainda.</p>}
          {squads.map((squad) => (
            <div key={squad.id} className="cartao flex flex-wrap items-center gap-4 p-4">
              {squad.logoPath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={getSquadLogoPublicUrl(squad.logoPath)}
                  alt={squad.name}
                  className="size-12 rounded-controle object-cover"
                />
              ) : (
                <span className="flex size-12 items-center justify-center rounded-controle bg-linha-2">
                  <Users2 className="size-5 text-tinta-3" strokeWidth={1.5} />
                </span>
              )}

              <form action={updateSquadNameAction.bind(null, squad.id)} className="flex items-center gap-1.5">
                <Input name="name" defaultValue={squad.name} className="h-8 w-40 text-sm" />
                <Button type="submit" size="sm" variant="outline">
                  Salvar nome
                </Button>
              </form>

              <form action={updateSquadLogoAction.bind(null, squad.id)} className="flex items-center gap-1.5">
                <input type="file" name="logo" accept="image/jpeg,image/png" required className="text-xs" />
                <Button type="submit" size="sm" variant="outline">
                  Trocar logo
                </Button>
              </form>

              <span className="text-xs text-tinta-3">
                {squad._count.clients} cliente(s) · {squad._count.members} redator(es)
              </span>

              <Link href={`/squads/${squad.id}`} className="ml-auto text-sm font-medium text-mata">
                Ver clientes
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
