import { Image as ImageIcon, Trash2, Send, Download } from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PieceFieldsEditor } from "@/components/client/PieceFieldsEditor";
import { BotaoGerar } from "@/components/client/BotaoGerar";
import { PIECE_FORMAT_LABEL, parseSlides, type PieceFormat } from "@/lib/contentPiece";
import {
  generateTextAction,
  editTextAction,
  approveTextAction,
  uploadTextMediaAction,
  removeTextMediaAction,
  publishNowAction,
} from "@/app/(dashboard)/clients/[clientId]/actions";

const CHANNEL_LABEL: Record<string, string> = { INSTAGRAM: "Instagram", FACEBOOK: "Facebook" };
const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Agendado",
  PUBLISHING: "Publicando",
  PUBLISHED: "Publicado",
  ERROR: "Erro",
};

const FORMAT_LABEL: Record<string, string> = {
  IMAGE: "Imagem única",
  CAROUSEL: "Carrossel (2 a 10 imagens)",
  REELS: "Reels (1 vídeo)",
  VIDEO: "Vídeo (Facebook)",
  STORIES: "Stories (Instagram)",
};

export async function TextsTab({ clientId, period }: { clientId: string; period: string }) {
  const briefing = await db.briefing.findUnique({ where: { clientId_period: { clientId, period } } });

  if (!briefing) {
    return <div className="cartao p-8 text-center text-sm text-tinta-3">Salve o briefing e selecione temas para gerar os textos.</div>;
  }

  const [themes, account] = await Promise.all([
    db.contentTheme.findMany({
      where: { briefingId: briefing.id, status: "SELECTED" },
      orderBy: { createdAt: "asc" },
      include: { texts: { orderBy: { version: "desc" }, include: { scheduledPosts: { orderBy: { createdAt: "desc" } } } } },
    }),
    db.instagramAccount.findUnique({ where: { clientId } }),
  ]);

  const channels = [
    ...(account ? [{ value: "instagram", label: "Instagram" }] : []),
    ...(account?.pageId ? [{ value: "facebook", label: "Facebook" }] : []),
  ];

  return (
    <div className="space-y-6">
      {themes.length === 0 && (
        <div className="cartao p-8 text-center text-sm text-tinta-3">
          Nenhum tema selecionado. Volte à etapa 4 e escolha os temas do mês.
        </div>
      )}

      {themes.map((theme) => (
        <ThemeTextCard key={theme.id} clientId={clientId} theme={theme} channels={channels} />
      ))}

      {themes.length > 0 && (
        <div className="cartao flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <h3 className="font-semibold">Baixar o conteúdo do mês</h3>
            <p className="mt-1 text-sm text-tinta-3">
              Um arquivo Markdown com o briefing, as palavras-chave e todos os posts — legenda, texto da arte e
              cards. Posts ainda não aprovados vêm marcados como rascunho.
            </p>
          </div>
          <a
            href={`/api/clients/${clientId}/conteudo?period=${period}`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-controle border border-linha bg-carta px-3 py-1.5 text-sm shadow-carta hover:bg-linha-2"
          >
            <Download className="size-4" strokeWidth={1.5} />
            Baixar .md
          </a>
        </div>
      )}
    </div>
  );
}

function ThemeTextCard({
  clientId,
  theme,
  channels,
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
      pieceFormat: string | null;
      imageText: string | null;
      slides: unknown;
      scheduledPosts: {
        id: string;
        channel: string;
        status: string;
        permalink: string | null;
        errorMessage: string | null;
        createdAt: Date;
      }[];
    }[];
  };
  channels: { value: string; label: string }[];
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
        <div className="space-y-1.5">
          <label className="rotulo">Formato da peça</label>
          <div className="flex flex-wrap gap-4">
            {(Object.keys(PIECE_FORMAT_LABEL) as PieceFormat[]).map((valor) => (
              <label key={valor} className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name="pieceFormat"
                  value={valor}
                  defaultChecked={(latest?.pieceFormat ?? "CARD") === valor}
                />
                {PIECE_FORMAT_LABEL[valor]}
              </label>
            ))}
          </div>
        </div>
        <Input name="instructions" placeholder="Instruções extras para a IA (ângulo, CTA, o que evitar...)" />
        <label className="flex items-start gap-2 text-xs text-tinta-2">
          <input type="checkbox" name="saveAsRule" className="mt-0.5" />
          <span>
            Guardar como regra fixa deste cliente. Marque quando for uma correção que vale sempre — ela passa a
            valer em toda geração futura, em vez de você repetir a instrução todo mês.
          </span>
        </label>
        <BotaoGerar label={latest ? "Gerar nova versão" : "Gerar peça"} dica="Costuma levar de 15 a 40 segundos." />
      </form>

      {latest && <EditableText clientId={clientId} text={latest} channels={channels} />}

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
  channels,
}: {
  clientId: string;
  text: {
    id: string;
    content: string;
    status: string;
    mediaFormat: string | null;
    mediaPaths: unknown;
    pieceFormat: string | null;
    imageText: string | null;
    slides: unknown;
    scheduledPosts?: {
      id: string;
      channel: string;
      status: string;
      permalink: string | null;
      errorMessage: string | null;
      createdAt: Date;
    }[];
  };
  channels: { value: string; label: string }[];
}) {
  const editAction = editTextAction.bind(null, clientId, text.id);
  const approveAction = approveTextAction.bind(null, clientId, text.id);
  const uploadMediaAction = uploadTextMediaAction.bind(null, clientId, text.id);
  const removeMediaAction = removeTextMediaAction.bind(null, clientId, text.id);
  const publishAction = publishNowAction.bind(null, clientId, text.id);
  const mediaPaths = (text.mediaPaths as string[] | null) ?? [];
  const scheduledPosts = text.scheduledPosts ?? [];

  return (
    <div className="mt-5 space-y-3">
      <PieceFieldsEditor
        action={editAction}
        pieceFormat={(text.pieceFormat as PieceFormat | null) ?? null}
        caption={text.content}
        imageText={text.imageText}
        slides={parseSlides(text.slides)}
      />

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

      {text.status === "APPROVED" && mediaPaths.length > 0 && channels.length > 0 && (
        <form action={publishAction} className="rounded-controle border border-linha p-4">
          <h4 className="rotulo mb-2">Publicar / Agendar</h4>
          <div className="flex flex-wrap gap-4">
            {channels.map((c) => (
              <label key={c.value} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" name="channels" value={c.value} />
                {c.label}
              </label>
            ))}
          </div>
          <Textarea
            name="caption"
            defaultValue={text.content}
            rows={4}
            className="mt-3 text-sm"
            placeholder="Legenda a publicar (pode ajustar sem alterar o texto aprovado)"
          />
          <Button type="submit" size="sm" className="mt-3">
            <Send className="mr-1.5 size-4" strokeWidth={1.5} />
            Publicar agora
          </Button>
        </form>
      )}

      {text.status === "APPROVED" && mediaPaths.length > 0 && channels.length === 0 && (
        <p className="text-xs text-tinta-3">
          Conecte o Instagram e/ou Facebook do cliente na aba de Contexto para poder publicar.
        </p>
      )}

      {scheduledPosts.length > 0 && (
        <div className="space-y-1.5 text-xs text-tinta-3">
          <h4 className="rotulo">Histórico de publicações</h4>
          {scheduledPosts.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2">
              <Badge variant={p.status === "PUBLISHED" ? "default" : p.status === "ERROR" ? "outline" : "secondary"}>
                {STATUS_LABEL[p.status] ?? p.status}
              </Badge>
              <span>{CHANNEL_LABEL[p.channel] ?? p.channel}</span>
              <span>{p.createdAt.toLocaleString("pt-BR")}</span>
              {p.permalink && (
                <a href={p.permalink} target="_blank" rel="noreferrer" className="text-mata underline">
                  Ver publicação
                </a>
              )}
              {p.errorMessage && <span className="text-alerta">{p.errorMessage}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
