import { PenLine, Sparkles } from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { generateTextAction, editTextAction, approveTextAction } from "@/app/(dashboard)/clients/[clientId]/actions";

export async function TextsTab({ clientId, period }: { clientId: string; period: string }) {
  const briefing = await db.briefing.findUnique({ where: { clientId_period: { clientId, period } } });

  if (!briefing) {
    return <div className="cartao p-8 text-center text-sm text-tinta-3">Salve o briefing e selecione temas para gerar os textos.</div>;
  }

  const themes = await db.contentTheme.findMany({
    where: { briefingId: briefing.id, status: "SELECTED" },
    orderBy: { createdAt: "asc" },
    include: { texts: { orderBy: { version: "desc" } } },
  });

  return (
    <div className="space-y-6">
      {themes.length === 0 && (
        <div className="cartao p-8 text-center text-sm text-tinta-3">
          Nenhum tema selecionado. Volte à etapa 4 e escolha os temas do mês.
        </div>
      )}

      {themes.map((theme) => (
        <ThemeTextCard key={theme.id} clientId={clientId} theme={theme} />
      ))}
    </div>
  );
}

function ThemeTextCard({
  clientId,
  theme,
}: {
  clientId: string;
  theme: {
    id: string;
    title: string;
    texts: { id: string; version: number; content: string; status: string }[];
  };
}) {
  const [latest, ...history] = theme.texts;
  const generateAction = generateTextAction.bind(null, clientId, theme.id);

  return (
    <div className="cartao p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="flex-1 font-semibold">{theme.title}</h3>
        {latest && <Badge variant="secondary">v{latest.version}</Badge>}
        {latest?.status === "APPROVED" && <Badge>Aprovado</Badge>}
      </div>

      <form action={generateAction} className="mt-4 space-y-3">
        <Input name="instructions" placeholder="Instruções extras para a IA (formato, canal, CTA...)" />
        <Button type="submit">
          <Sparkles className="mr-1.5 size-4" strokeWidth={1.5} />
          {latest ? "Gerar nova versão" : "Gerar texto final"}
        </Button>
      </form>

      {latest && <EditableText clientId={clientId} text={latest} />}

      {history.length > 0 && (
        <details className="mt-4 text-sm text-tinta-3">
          <summary className="cursor-pointer">Ver {history.length} versão(ões) anterior(es)</summary>
          <ul className="mt-2 space-y-2">
            {history.map((version) => (
              <li key={version.id} className="rounded-controle bg-linha-2 p-2 text-xs whitespace-pre-wrap">
                v{version.version}: {version.content}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function EditableText({
  clientId,
  text,
}: {
  clientId: string;
  text: { id: string; content: string; status: string };
}) {
  const editAction = editTextAction.bind(null, clientId, text.id);
  const approveAction = approveTextAction.bind(null, clientId, text.id);

  return (
    <div className="mt-5 space-y-3">
      <form action={editAction}>
        <Textarea name="content" defaultValue={text.content} rows={16} className="text-sm leading-relaxed" />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="submit" variant="outline">
            <PenLine className="mr-1.5 size-4" strokeWidth={1.5} />
            Salvar edição
          </Button>
        </div>
      </form>

      {text.status !== "APPROVED" && (
        <form action={approveAction}>
          <Button type="submit" variant="secondary">
            Aprovar texto
          </Button>
        </form>
      )}
    </div>
  );
}
