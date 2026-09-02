import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateClientAction, listWriters, listSquads } from "../../actions";
import { DeleteClientButton } from "@/components/client/DeleteClientButton";

export default async function EditClientPage({ params }: { params: Promise<{ clientId: string }> }) {
  await requireAdmin();
  const { clientId } = await params;

  const [client, writers, squads] = await Promise.all([
    db.client.findUnique({ where: { id: clientId } }),
    listWriters(),
    listSquads(),
  ]);
  if (!client) notFound();

  const action = updateClientAction.bind(null, clientId);

  return (
    <div className="mx-auto max-w-md px-6 py-10">
      <h1 className="display text-3xl">Editar cliente</h1>

      <form action={action} className="cartao mt-6 space-y-4 p-6">
        <div className="space-y-2">
          <Label htmlFor="name">Nome do cliente</Label>
          <Input id="name" name="name" defaultValue={client.name} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="acronym">Sigla</Label>
          <Input
            id="acronym"
            name="acronym"
            defaultValue={client.acronym ?? ""}
            required
            maxLength={5}
            placeholder="ex: ETM"
            className="w-[120px]"
          />
          <p className="text-xs text-tinta-3">
            De 2 a 5 letras. Aparece nos títulos de demanda e de post. Mudar aqui atualiza os títulos antigos
            também, porque eles são montados na hora e não guardados.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="niche">Nicho / segmento</Label>
          <Input id="niche" name="niche" defaultValue={client.niche} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ownerId">Responsável</Label>
          <select
            id="ownerId"
            name="ownerId"
            defaultValue={client.ownerId ?? ""}
            className="block w-full rounded-controle border border-linha bg-carta px-3 py-1.5 text-sm shadow-carta"
          >
            <option value="">Sem responsável definido</option>
            {writers.map((writer) => (
              <option key={writer.id} value={writer.id}>
                {writer.name} {writer.role === "ADMIN" ? "(Admin)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="squadId">Squad</Label>
          <select
            id="squadId"
            name="squadId"
            defaultValue={client.squadId ?? ""}
            className="block w-full rounded-controle border border-linha bg-carta px-3 py-1.5 text-sm shadow-carta"
          >
            <option value="">Sem squad definido</option>
            {squads.map((squad) => (
              <option key={squad.id} value={squad.id}>
                {squad.name}
              </option>
            ))}
          </select>
        </div>

        <Button type="submit">Salvar alterações</Button>
      </form>

      <div className="cartao mt-6 space-y-3 border-risco/30 p-6">
        <div>
          <h2 className="text-sm font-semibold text-risco">Excluir cliente</h2>
          <p className="mt-1 text-xs text-tinta-3">
            Remove o cliente e tudo ligado a ele — documentos, briefings, temas e textos gerados. Não tem volta.
          </p>
        </div>
        <DeleteClientButton clientId={clientId} clientName={client.name} />
      </div>
    </div>
  );
}
