import { Save } from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { upsertBriefingAction } from "@/app/(dashboard)/clients/[clientId]/actions";

const FIELDS: Array<{ key: string; label: string; rows: number; placeholder?: string }> = [
  { key: "goals", label: "Objetivos do mês", rows: 3 },
  { key: "campaigns", label: "Campanhas em foco", rows: 3 },
  { key: "highlights", label: "Produtos ou serviços em destaque", rows: 2 },
  { key: "keyDates", label: "Datas importantes", rows: 2, placeholder: "ex.: 15/05 lançamento, 30/05 webinar" },
  { key: "restrictions", label: "Restrições (o que não dizer)", rows: 2 },
];

export async function BriefingTab({ clientId, period }: { clientId: string; period: string }) {
  const briefing = await db.briefing.findUnique({ where: { clientId_period: { clientId, period } } });
  const action = upsertBriefingAction.bind(null, clientId, period);

  const values: Record<string, string> = {
    goals: briefing?.goals ?? "",
    campaigns: briefing?.campaigns ?? "",
    highlights: briefing?.highlights ?? "",
    keyDates: briefing?.keyDates ?? "",
    restrictions: briefing?.restrictions ?? "",
  };

  return (
    <form action={action} className="cartao space-y-5 p-6">
      <div>
        <h2 className="text-lg font-semibold">Briefing mensal</h2>
        <p className="mt-1 text-sm text-tinta-3">
          É o insumo principal da geração de temas, junto com o contexto do cliente e as palavras-chave.
        </p>
      </div>

      {FIELDS.map((field) => (
        <div key={field.key} className="space-y-2">
          <Label htmlFor={field.key}>{field.label}</Label>
          <Textarea
            id={field.key}
            name={field.key}
            rows={field.rows}
            placeholder={field.placeholder}
            defaultValue={values[field.key]}
          />
        </div>
      ))}

      <Button type="submit">
        <Save className="mr-1.5 size-4" strokeWidth={1.5} />
        {briefing ? "Atualizar briefing" : "Salvar briefing"}
      </Button>
    </form>
  );
}
