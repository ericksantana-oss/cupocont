import { FileText, Link2, Trash2, Upload } from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { uploadDocumentAction, deleteDocumentAction } from "@/app/(dashboard)/clients/[clientId]/actions";
import { InstagramCard } from "@/components/client/InstagramCard";

const STATUS_LABEL: Record<string, string> = {
  PROCESSING: "processando",
  READY: "indexado",
  FAILED: "falhou",
};

export async function ContextTab({ clientId }: { clientId: string }) {
  const documents = await db.clientDocument.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { chunks: true } } },
  });

  const uploadAction = uploadDocumentAction.bind(null, clientId);
  const removeAction = deleteDocumentAction.bind(null, clientId);

  return (
    <div className="space-y-6">
      <InstagramCard clientId={clientId} />

      <div className="cartao p-6">
        <h2 className="text-lg font-semibold">Base de conhecimento do cliente</h2>
        <p className="mt-1 text-sm text-tinta-3">
          Suba guia de tom de voz, briefings antigos, textos publicados, personas e glossário de termos. Tudo aqui é
          usado como referência obrigatória pela IA.
        </p>

        <form action={uploadAction} className="mt-5 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Input type="file" name="file" accept=".pdf,.docx,.txt" className="max-w-xs" />
            <Button type="submit">
              <Upload className="mr-1.5 size-4" strokeWidth={1.5} />
              Enviar PDF / DOCX / TXT
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Input name="sourceUrl" placeholder="https://link-de-referencia.com/artigo" className="max-w-md" />
            <Button type="submit" variant="outline">
              <Link2 className="mr-1.5 size-4" strokeWidth={1.5} />
              Importar link
            </Button>
          </div>
        </form>
      </div>

      <div className="cartao divide-y divide-linha-2">
        {documents.length === 0 && <p className="p-6 text-sm text-tinta-3">Nenhum documento indexado ainda.</p>}
        {documents.map((doc) => (
          <div key={doc.id} className="flex flex-wrap items-center gap-3 p-4">
            <FileText className="size-4 text-tinta-3" strokeWidth={1.5} />
            <span className="flex-1 truncate text-sm font-medium">{doc.fileName}</span>
            <Badge variant="secondary">{doc.fileType}</Badge>
            <Badge variant={doc.status === "READY" ? "default" : "outline"}>
              {doc.status === "READY" ? `${doc._count.chunks} trechos` : STATUS_LABEL[doc.status]}
            </Badge>
            <form action={removeAction.bind(null, doc.id)}>
              <Button type="submit" variant="ghost" size="icon" aria-label="Remover">
                <Trash2 className="size-4" strokeWidth={1.5} />
              </Button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
