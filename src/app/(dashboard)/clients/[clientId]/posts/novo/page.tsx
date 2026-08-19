import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireClientAccess } from "@/lib/auth/guards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createScheduledPostAction } from "../actions";

const FORMAT_OPTIONS = [
  { value: "IMAGE", label: "Imagem única (Instagram e Facebook)" },
  { value: "CAROUSEL", label: "Carrossel — 2 a 10 imagens (Instagram)" },
  { value: "REELS", label: "Reels — 1 vídeo (Instagram)" },
  { value: "VIDEO", label: "Vídeo (Facebook)" },
  { value: "STORIES", label: "Stories — 1 imagem ou vídeo (Instagram)" },
];

export default async function NewScheduledPostPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  await requireClientAccess(clientId);

  const client = await db.client.findUnique({ where: { id: clientId } });
  if (!client) notFound();

  const account = await db.instagramAccount.findUnique({ where: { clientId } });
  const channels = [
    ...(account ? [{ value: "instagram", label: `Instagram (@${account.igUsername})` }] : []),
    ...(account?.pageId ? [{ value: "facebook", label: `Facebook (${account.pageName})` }] : []),
  ];

  const createAction = createScheduledPostAction.bind(null, clientId);

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link href={`/clients/${clientId}/posts`} className="inline-flex items-center text-sm text-tinta-3 hover:text-tinta">
        <ArrowLeft className="mr-1.5 size-4" strokeWidth={1.5} />
        Posts de {client.name}
      </Link>

      <h1 className="display mt-4 text-3xl">Agendar post</h1>

      {channels.length === 0 ? (
        <div className="cartao mt-8 p-8 text-center text-sm text-tinta-3">
          Conecte o Instagram e/ou Facebook do cliente na{" "}
          <Link href={`/clients/${clientId}/contexto`} className="text-mata underline">
            aba de Contexto
          </Link>{" "}
          antes de agendar.
        </div>
      ) : (
        <form action={createAction} className="cartao mt-8 space-y-5 p-6">
          <div className="space-y-2">
            <Label>Canais</Label>
            <div className="flex flex-wrap gap-4">
              {channels.map((c) => (
                <label key={c.value} className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" name="channels" value={c.value} />
                  {c.label}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="format">Formato</Label>
            <select
              id="format"
              name="format"
              className="block w-full rounded-controle border border-linha bg-carta px-3 py-1.5 text-sm shadow-carta"
            >
              {FORMAT_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="files">Arquivo(s)</Label>
            <input
              id="files"
              type="file"
              name="files"
              multiple
              accept="image/jpeg,image/png,video/mp4,video/quicktime"
              required
              className="block text-sm"
            />
            <p className="text-xs text-tinta-3">JPEG, PNG, MP4 ou MOV. Carrossel exige de 2 a 10 arquivos.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="caption">Legenda</Label>
            <Textarea id="caption" name="caption" rows={5} placeholder="Legenda do post (Stories não usa legenda)" />
          </div>

          <div className="space-y-2">
            <Label>Quando publicar</Label>
            <div className="flex items-center gap-2">
              <input type="radio" id="now" name="scheduleMode" value="now" defaultChecked />
              <label htmlFor="now" className="text-sm">Publicar agora</label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input type="radio" id="later" name="scheduleMode" value="later" />
              <label htmlFor="later" className="text-sm">Agendar para:</label>
              <Input type="date" name="scheduledDate" className="w-auto" />
              <Input type="time" name="scheduledTime" className="w-auto" />
            </div>
          </div>

          <Button type="submit">Confirmar</Button>
        </form>
      )}
    </div>
  );
}
