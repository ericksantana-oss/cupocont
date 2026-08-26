import { Trash2, Scale } from "lucide-react";
import { listClientRules } from "@/lib/clientRules";
import { addClientRuleAction, removeClientRuleAction } from "@/app/(dashboard)/clients/[clientId]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export async function ClientRulesCard({ clientId }: { clientId: string }) {
  const regras = await listClientRules(clientId);
  const addAction = addClientRuleAction.bind(null, clientId);

  return (
    <div className="cartao p-6">
      <h3 className="flex items-center gap-1.5 font-semibold">
        <Scale className="size-4 text-mata" strokeWidth={1.5} />
        Regras fixas deste cliente
      </h3>
      <p className="mt-1 text-sm text-tinta-3">
        Correções que a equipe não quer repetir todo mês. Valem em toda geração de tema, texto e e-mail deste
        cliente. Nascem do checkbox na hora de regenerar um texto, ou podem ser escritas direto aqui.
      </p>

      {regras.length > 0 && (
        <ul className="mt-4 divide-y divide-linha-2">
          {regras.map((regra) => (
            <li key={regra.id} className="flex items-start gap-3 py-2.5">
              <span className="flex-1 text-sm">{regra.rule}</span>
              <span className="shrink-0 text-xs text-tinta-3">{regra.createdBy.name}</span>
              <form action={removeClientRuleAction.bind(null, clientId, regra.id)}>
                <Button type="submit" variant="ghost" size="sm" aria-label="Remover regra">
                  <Trash2 className="size-3.5" strokeWidth={1.5} />
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={addAction} className="mt-4 flex flex-wrap gap-2">
        <Input name="rule" placeholder="ex.: nunca usar 'oportunidade única'" className="flex-1" required />
        <Button type="submit" variant="outline">
          Adicionar regra
        </Button>
      </form>
    </div>
  );
}
