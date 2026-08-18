import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { periodLabel } from "@/lib/periodo";
import type { Keyword } from "@/lib/keywords/provider";
import { addManualKeywordAction } from "@/app/(dashboard)/clients/[clientId]/actions";

export async function KeywordsTab({ clientId, period }: { clientId: string; period: string }) {
  const reports = await db.keywordReport.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
  });

  const addManualAction = addManualKeywordAction.bind(null, clientId, period);

  return (
    <div className="space-y-6">
      <div className="cartao p-6">
        <h2 className="text-lg font-semibold">Palavras-chave de {periodLabel(period)}</h2>
        <p className="mt-1 text-sm text-tinta-3">
          Cadastre manualmente as palavras-chave mais relevantes do período — essa lista entra no cruzamento
          que gera os temas do mês.
        </p>

        <form action={addManualAction} className="mt-4 flex flex-wrap gap-2">
          <Input name="term" placeholder="termo" className="max-w-xs" required />
          <Input name="volume" type="number" placeholder="volume (opcional)" className="max-w-[160px]" />
          <Button type="submit">
            <Plus className="mr-1.5 size-4" strokeWidth={1.5} />
            Adicionar
          </Button>
        </form>
      </div>

      {reports.map((report) => (
        <div key={report.id} className="cartao p-6">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-semibold">{periodLabel(report.period)}</h3>
            <span className="text-xs text-tinta-3">{report.createdAt.toLocaleDateString("pt-BR")}</span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(report.keywords as Keyword[]).map((keyword, i) => (
              <span
                key={`${keyword.term}-${i}`}
                className="inline-flex items-center gap-1.5 rounded-controle border border-linha bg-linha-2 px-3 py-1 text-sm"
              >
                {keyword.term}
                {keyword.volume > 0 && <span className="text-xs text-tinta-3">{keyword.volume}</span>}
              </span>
            ))}
          </div>
        </div>
      ))}

      {reports.length === 0 && <p className="text-sm text-tinta-3">Nenhuma palavra-chave cadastrada ainda.</p>}
    </div>
  );
}
