import Link from "next/link";
import { ArrowLeft, ArrowRight, Users2 } from "lucide-react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guards";
import { getSquadLogoPublicUrl } from "@/lib/storage";

export default async function SquadClientsPage({ params }: { params: Promise<{ squadId: string }> }) {
  const { squadId } = await params;
  const user = await requireUser();

  if (user.role === "WRITER" && user.squadId !== squadId) notFound();

  const squad = await db.squad.findUnique({ where: { id: squadId } });
  if (!squad) notFound();

  const clients = await db.client.findMany({ where: { squadId }, orderBy: { name: "asc" } });

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Link href="/clients" className="inline-flex items-center text-sm text-tinta-3 hover:text-tinta">
        <ArrowLeft className="mr-1.5 size-4" strokeWidth={1.5} />
        Squads
      </Link>

      <div className="mt-4 flex items-center gap-3">
        {squad.logoPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={getSquadLogoPublicUrl(squad.logoPath)} alt={squad.name} className="size-12 rounded-controle object-cover" />
        ) : (
          <span className="flex size-12 items-center justify-center rounded-controle bg-linha-2">
            <Users2 className="size-5 text-tinta-3" strokeWidth={1.5} />
          </span>
        )}
        <h1 className="display text-3xl">{squad.name}</h1>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {clients.length === 0 && (
          <div className="cartao col-span-full p-8 text-center text-sm text-tinta-3">
            Nenhum cliente neste squad ainda.
          </div>
        )}
        {clients.map((client) => (
          <Link key={client.id} href={`/clients/${client.id}`} className="cartao group p-6 transition-shadow hover:shadow-alto">
            <h3 className="text-lg font-semibold">{client.name}</h3>
            <p className="mt-1 text-sm text-tinta-3">{client.niche || "Sem nicho definido"}</p>
            <span className="mt-4 inline-flex items-center text-sm font-medium text-mata">
              Abrir fluxo
              <ArrowRight className="ml-1 size-4 transition-transform group-hover:translate-x-0.5" strokeWidth={1.5} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
