import { Save } from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { upsertBriefingAction } from "@/app/(dashboard)/clients/[clientId]/actions";

export async function BriefingTab({ clientId, period }: { clientId: string; period: string }) {
  const briefing = await db.briefing.findUnique({ where: { clientId_period: { clientId, period } } });
  const action = upsertBriefingAction.bind(null, clientId, period);

  return (
    <form action={action} className="cartao space-y-5 p-6">
      <div>
        <h2 className="text-lg font-semibold">Briefing mensal</h2>
        <p className="mt-1 text-sm text-tinta-3">
          É o insumo principal da geração de temas, junto com o contexto do cliente e as palavras-chave.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="goals">Briefing</Label>
        <Textarea
          id="goals"
          name="goals"
          rows={14}
          defaultValue={briefing?.goals ?? ""}
          placeholder="Objetivos do mês, campanhas em foco, produtos em destaque, restrições — tudo o que a IA precisa saber para gerar os temas."
          className="text-sm leading-relaxed"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="keyDates">Datas comemorativas</Label>
        <Textarea
          id="keyDates"
          name="keyDates"
          rows={4}
          defaultValue={briefing?.keyDates ?? ""}
          placeholder="ex.: 15/08 abertura do estande, 07/09 Independência, 15/09 aniversário do bairro"
          className="text-sm"
        />
      </div>

      <Button type="submit">
        <Save className="mr-1.5 size-4" strokeWidth={1.5} />
        {briefing ? "Atualizar briefing" : "Salvar briefing"}
      </Button>
    </form>
  );
}
