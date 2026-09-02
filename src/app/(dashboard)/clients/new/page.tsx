import { requireAdmin } from "@/lib/auth/guards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClientAction, listWriters, listSquads } from "../actions";

export default async function NewClientPage() {
  await requireAdmin();
  const [writers, squads] = await Promise.all([listWriters(), listSquads()]);

  return (
    <div className="mx-auto max-w-md px-6 py-10">
      <h1 className="display text-3xl">Novo cliente</h1>

      <form action={createClientAction} className="cartao mt-6 space-y-4 p-6">
        <div className="space-y-2">
          <Label htmlFor="name">Nome do cliente</Label>
          <Input id="name" name="name" required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="acronym">Sigla</Label>
          <Input id="acronym" name="acronym" required maxLength={5} placeholder="ex: ETM" className="w-[120px]" />
          <p className="text-xs text-tinta-3">
            De 2 a 5 letras, usada nos títulos de demanda e de post: ETM | 92857 | Redes Sociais Setembro.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="niche">Nicho / segmento</Label>
          <Input id="niche" name="niche" required placeholder="ex: incorporadora de alto padrão, imóveis na praia..." />
          <p className="text-xs text-tinta-3">Usado para buscar as palavras-chave do período relacionadas ao cliente.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ownerId">Responsável</Label>
          <select
            id="ownerId"
            name="ownerId"
            className="block w-full rounded-controle border border-linha bg-carta px-3 py-1.5 text-sm shadow-carta"
          >
            <option value="">Sem responsável definido</option>
            {writers.map((writer) => (
              <option key={writer.id} value={writer.id}>
                {writer.name} {writer.role === "ADMIN" ? "(Admin)" : ""}
              </option>
            ))}
          </select>
          <p className="text-xs text-tinta-3">Aparece no painel admin para acompanhar o andamento por pessoa.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="squadId">Squad</Label>
          <select
            id="squadId"
            name="squadId"
            className="block w-full rounded-controle border border-linha bg-carta px-3 py-1.5 text-sm shadow-carta"
          >
            <option value="">Sem squad definido</option>
            {squads.map((squad) => (
              <option key={squad.id} value={squad.id}>
                {squad.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-tinta-3">Define quem tem acesso automático a este cliente.</p>
        </div>

        <Button type="submit">Criar cliente</Button>
      </form>
    </div>
  );
}
