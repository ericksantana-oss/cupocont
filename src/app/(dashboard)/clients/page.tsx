import Link from "next/link";
import { ArrowRight, Clock, Plus, Search, Users2 } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CupolaMark } from "@/components/CupolaMark";
import { getSquadLogoPublicUrl } from "@/lib/storage";
import { periodLabel } from "@/lib/periodo";
import { listAccessibleClients, listRecentClients, listPendingApprovals } from "./actions";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  const { q } = await searchParams;

  const showSquadPicker = (user.role === "ADMIN" || user.role === "INTERN") && !q;

  const [clients, recentClients, pendingApprovals, squads] = await Promise.all([
    listAccessibleClients(q),
    listRecentClients(),
    listPendingApprovals(),
    showSquadPicker
      ? db.squad.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { clients: true } } } })
      : Promise.resolve([]),
  ]);
  const firstName = user.name.split(" ")[0];

  return (
    <div>
      <div className="sup-campo grao px-6 py-16">
        <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center text-center">
          <CupolaMark className="size-12 drop-shadow-[0_0_24px_rgba(176,249,10,0.5)]" />
          <h1 className="editorial mt-6 text-4xl text-papel">
            {greeting()}, <span className="text-neon">{firstName}</span>
          </h1>

          <form action="/clients" className="mt-8 w-full">
            <div className="flex items-center gap-2 rounded-campo bg-carta px-4 py-3 shadow-alto">
              <Search className="size-4 shrink-0 text-tinta-3" strokeWidth={1.5} />
              <Input
                name="q"
                defaultValue={q ?? ""}
                placeholder="Buscar cliente por nome ou nicho..."
                className="border-none bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
            </div>
          </form>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-10">
        {pendingApprovals.length > 0 && !q && (
          <div className="mb-10">
            <h2 className="rotulo">
              {pendingApprovals.length} texto(s) aguardando aprovação
            </h2>
            <div className="cartao mt-3 divide-y divide-linha-2">
              {pendingApprovals.map((item) => (
                <Link
                  key={item.textId}
                  href={`/clients/${item.clientId}/conteudo?tab=textos&period=${item.period}`}
                  className="flex flex-wrap items-center gap-3 p-4 hover:bg-bruma/10"
                >
                  <Clock className="size-4 shrink-0 text-alerta" strokeWidth={1.5} />
                  <span className="font-medium">{item.clientName}</span>
                  <span className="text-tinta-3">·</span>
                  <span className="flex-1 truncate text-sm text-tinta-2">{item.themeTitle}</span>
                  <Badge variant="secondary">{periodLabel(item.period)}</Badge>
                </Link>
              ))}
            </div>
          </div>
        )}

        {recentClients.length > 0 && !q && (
          <div className="mb-10">
            <h2 className="rotulo">Recentes</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              {recentClients.map((client) => (
                <ClientCard key={client.id} id={client.id} name={client.name} niche={client.niche} />
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="rotulo">
            {q ? `Resultados para "${q}"` : showSquadPicker ? "Squads" : "Todos os clientes"}
          </h2>
          <div className="flex gap-2">
            {user.role === "ADMIN" && (
              <Button asChild size="sm" variant="outline">
                <Link href="/squads">Gerenciar squads</Link>
              </Button>
            )}
            {user.role === "ADMIN" && (
              <Button asChild size="sm">
                <Link href="/clients/new">
                  <Plus className="mr-1.5 size-4" strokeWidth={1.5} />
                  Novo cliente
                </Link>
              </Button>
            )}
          </div>
        </div>

        {showSquadPicker ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {squads.length === 0 && (
              <div className="cartao col-span-full p-8 text-center text-sm text-tinta-3">
                Nenhum squad criado ainda.{" "}
                <Link href="/squads" className="text-mata underline">
                  Criar squad
                </Link>
              </div>
            )}
            {squads.map((squad) => (
              <Link key={squad.id} href={`/squads/${squad.id}`} className="cartao group flex items-center gap-4 p-6 transition-shadow hover:shadow-alto">
                {squad.logoPath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={getSquadLogoPublicUrl(squad.logoPath)} alt={squad.name} className="size-12 rounded-controle object-cover" />
                ) : (
                  <span className="flex size-12 items-center justify-center rounded-controle bg-linha-2">
                    <Users2 className="size-5 text-tinta-3" strokeWidth={1.5} />
                  </span>
                )}
                <div>
                  <h3 className="font-semibold">{squad.name}</h3>
                  <p className="mt-1 text-sm text-tinta-3">{squad._count.clients} cliente(s)</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clients.length === 0 && (
              <div className="cartao col-span-full p-8 text-center">
                <p className="text-sm text-tinta-3">
                  {q
                    ? "Nenhum cliente encontrado."
                    : "Você ainda não foi designado a nenhum cliente. Fale com um admin."}
                </p>
              </div>
            )}

            {clients.map((client) => (
              <ClientCard key={client.id} id={client.id} name={client.name} niche={client.niche} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ClientCard({ id, name, niche }: { id: string; name: string; niche: string }) {
  return (
    <Link href={`/clients/${id}`} className="cartao group p-6 transition-shadow hover:shadow-alto">
      <h3 className="text-lg font-semibold">{name}</h3>
      <p className="mt-1 text-sm text-tinta-3">{niche || "Sem nicho definido"}</p>
      <span className="mt-4 inline-flex items-center text-sm font-medium text-mata">
        Abrir fluxo
        <ArrowRight className="ml-1 size-4 transition-transform group-hover:translate-x-0.5" strokeWidth={1.5} />
      </span>
    </Link>
  );
}
