import { Check, X, Repeat2 } from "lucide-react";
import { BotaoGerar } from "@/components/client/BotaoGerar";
import { buscarTemasRepetidos, type TemaRepetido } from "@/lib/themeSimilarity";
import { periodLabel } from "@/lib/periodo";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { generateThemesAction, updateThemeDecisionAction, editThemeAction } from "@/app/(dashboard)/clients/[clientId]/actions";

export async function ThemesTab({ clientId, period }: { clientId: string; period: string }) {
  const briefing = await db.briefing.findUnique({ where: { clientId_period: { clientId, period } } });

  if (!briefing) {
    return <div className="cartao p-8 text-center text-sm text-tinta-3">Salve o briefing do mês na etapa 3 para gerar temas.</div>;
  }

  const [themes, repetidos] = await Promise.all([
    db.contentTheme.findMany({
      where: { briefingId: briefing.id },
      orderBy: { createdAt: "asc" },
    }),
    // Compara com o que já virou conteúdo em outros meses deste cliente. Falhar aqui
    // não pode esconder os temas, então cai para "nenhum repetido".
    buscarTemasRepetidos(briefing.id).catch(() => [] as TemaRepetido[]),
  ]);

  const repetidoPorTema = new Map(repetidos.map((r) => [r.themeId, r]));

  const generateAction = generateThemesAction.bind(null, clientId, briefing.id);
  const selectedCount = themes.filter((t) => t.status === "SELECTED").length;

  return (
    <div className="space-y-6">
      <div className="cartao flex flex-wrap items-center gap-4 p-6">
        <div className="flex-1">
          <h2 className="text-lg font-semibold">Temas do mês</h2>
          <p className="mt-1 text-sm text-tinta-3">{selectedCount} tema(s) selecionado(s) para virar texto na etapa 5.</p>
        </div>
        <form action={generateAction}>
          <BotaoGerar label={themes.length === 0 ? "Gerar temas com IA" : "Gerar novamente"} dica="Costuma levar de 15 a 40 segundos." />
        </form>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {themes.length === 0 && <p className="col-span-full text-sm text-tinta-3">Nenhum tema gerado ainda.</p>}
        {themes.map((theme) => (
          <ThemeCard
            key={theme.id}
            clientId={clientId}
            theme={theme}
            repetido={repetidoPorTema.get(theme.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ThemeCard({
  clientId,
  theme,
  repetido,
}: {
  clientId: string;
  theme: { id: string; title: string; justification: string; status: string };
  repetido?: TemaRepetido;
}) {
  const decideAction = updateThemeDecisionAction.bind(null, clientId, theme.id);
  const editAction = editThemeAction.bind(null, clientId, theme.id);

  return (
    <div className={`cartao p-5 ${theme.status === "DISCARDED" ? "opacity-50" : ""}`}>
      {repetido && (
        <div className="mb-3 flex items-start gap-2 rounded-controle bg-alerta/10 p-2.5 text-xs text-tinta-2">
          <Repeat2 className="mt-0.5 size-3.5 shrink-0 text-alerta" strokeWidth={1.5} />
          <span>
            Parecido com um tema já publicado em {periodLabel(repetido.periodoAnterior)}:{" "}
            <strong className="font-medium">{repetido.tituloAnterior}</strong>
          </span>
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold leading-snug">{theme.title}</h3>
        {theme.status === "SELECTED" && <Badge>Selecionado</Badge>}
      </div>

      <form action={editAction} className="mt-2 space-y-2">
        <Input
          name="title"
          defaultValue={theme.title}
          className="border-transparent bg-transparent px-0 text-sm font-medium shadow-none focus-visible:border-linha focus-visible:bg-papel focus-visible:px-3"
        />
        <Textarea
          name="justification"
          defaultValue={theme.justification}
          rows={2}
          className="border-transparent bg-transparent px-0 text-sm text-tinta-3 shadow-none focus-visible:border-linha focus-visible:bg-papel focus-visible:px-3"
        />
        <Button type="submit" variant="link" size="sm" className="h-auto p-0 text-xs">
          Salvar edição
        </Button>
      </form>

      <div className="mt-4 flex gap-2">
        <form action={decideAction.bind(null, "SELECTED")}>
          <Button type="submit" size="sm" variant={theme.status === "SELECTED" ? "secondary" : "default"}>
            <Check className="mr-1.5 size-4" strokeWidth={1.5} />
            {theme.status === "SELECTED" ? "Remover seleção" : "Selecionar"}
          </Button>
        </form>
        <form action={decideAction.bind(null, "DISCARDED")}>
          <Button type="submit" size="sm" variant="ghost">
            <X className="mr-1.5 size-4" strokeWidth={1.5} />
            {theme.status === "DISCARDED" ? "Restaurar" : "Descartar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
