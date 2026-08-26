import { Save, Copy } from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { upsertBriefingAction, copyPreviousBriefingAction } from "@/app/(dashboard)/clients/[clientId]/actions";
import { periodLabel } from "@/lib/periodo";

export async function BriefingTab({ clientId, period }: { clientId: string; period: string }) {
  const briefing = await db.briefing.findUnique({ where: { clientId_period: { clientId, period } } });
  const action = upsertBriefingAction.bind(null, clientId, period);

  // Só oferece copiar quando o mês está em branco — 25 clientes x 12 meses são 300
  // briefings por ano começando do zero.
  const anterior = briefing
    ? null
    : await db.briefing.findFirst({
        where: { clientId, period: { lt: period } },
        orderBy: { period: "desc" },
        select: { period: true },
      });

  return (
    <div className="space-y-4">
      {/* Fora do form principal de proposito: form dentro de form e HTML invalido. */}
      {anterior && (
        <form
          action={copyPreviousBriefingAction.bind(null, clientId, period)}
          className="cartao flex flex-wrap items-center justify-between gap-3 p-4"
        >
          <span className="text-sm text-tinta-2">
            Este mês está em branco. Quer começar a partir de {periodLabel(anterior.period)}?
          </span>
          <Button type="submit" variant="outline" size="sm">
            <Copy className="mr-1.5 size-4" strokeWidth={1.5} />
            Copiar de {periodLabel(anterior.period)}
          </Button>
        </form>
      )}

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

      <div className="space-y-2">
        <Label htmlFor="suggestedThemes">Temas sugeridos pelo redator</Label>
        <Textarea
          id="suggestedThemes"
          name="suggestedThemes"
          rows={5}
          defaultValue={briefing?.suggestedThemes ?? ""}
          placeholder="Um tema por linha. A IA vai começar a lista por eles, adaptando ao tom do cliente, e completar o resto."
          className="text-sm"
        />
      </div>

        <Button type="submit">
          <Save className="mr-1.5 size-4" strokeWidth={1.5} />
          {briefing ? "Atualizar briefing" : "Salvar briefing"}
        </Button>
      </form>
    </div>
  );
}
