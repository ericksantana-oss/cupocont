import { PenLine, Sparkles, Image as ImageIcon, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  generateTextAction,
  editTextAction,
  approveTextAction,
  uploadTextMediaAction,
  removeTextMediaAction,
} from "@/app/(dashboard)/clients/[clientId]/actions";

const FORMAT_LABEL: Record<string, string> = {
  IMAGE: "Imagem única",
  CAROUSEL: "Carrossel (2 a 10 imagens)",
  REELS: "Reels (1 vídeo)",
  VIDEO: "Vídeo (Facebook)",
};

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
    texts: {
      id: string;
      version: number;
      content: string;
      status: string;
      mediaFormat: string | null;
      mediaPaths: unknown;
    }[];
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
  text: { id: string; content: string; status: string; mediaFormat: string | null; mediaPaths: unknown };
}) {
  const editAction = editTextAction.bind(null, clientId, text.id);
  const approveAction = approveTextAction.bind(null, clientId, text.id);
  const uploadMediaAction = uploadTextMediaAction.bind(null, clientId, text.id);
  const removeMediaAction = removeTextMediaAction.bind(null, clientId, text.id);
  const mediaPaths = (text.mediaPaths as string[] | null) ?? [];

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

      <div className="rounded-controle border border-linha p-4">
        <h4 className="rotulo mb-2">Mídia para publicação</h4>
        {mediaPaths.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary">{FORMAT_LABEL[text.mediaFormat ?? ""] ?? text.mediaFormat}</Badge>
            <span className="text-xs text-tinta-3">
              {mediaPaths.length} arquivo(s) anexado(s)
            </span>
            <form action={removeMediaAction}>
              <Button type="submit" variant="ghost" size="sm">
                <Trash2 className="mr-1.5 size-4" strokeWidth={1.5} />
                Remover
              </Button>
            </form>
          </div>
        ) : (
          <form action={uploadMediaAction} className="flex flex-wrap items-center gap-2">
            <select name="format" className="rounded-controle border border-linha bg-carta px-3 py-1 text-sm shadow-carta">
              {Object.entries(FORMAT_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <input type="file" name="files" multiple accept="image/jpeg,image/png,video/mp4,video/quicktime" required />
            <Button type="submit" size="sm">
              <ImageIcon className="mr-1.5 size-4" strokeWidth={1.5} />
              Anexar mídia
            </Button>
          </form>
        )}
      </div>

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
