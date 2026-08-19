import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireClientAccess } from "@/lib/auth/guards";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cancelScheduledPostAction } from "./actions";

const CHANNEL_LABEL: Record<string, string> = { INSTAGRAM: "Instagram", FACEBOOK: "Facebook" };
const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Agendado",
  PUBLISHING: "Publicando",
  PUBLISHED: "Publicado",
  ERROR: "Erro",
};
const FORMAT_LABEL: Record<string, string> = {
  IMAGE: "Imagem",
  CAROUSEL: "Carrossel",
  REELS: "Reels",
  VIDEO: "Vídeo",
  STORIES: "Stories",
};

export default async function PostsHistoryPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  await requireClientAccess(clientId);

  const client = await db.client.findUnique({ where: { id: clientId } });
  if (!client) notFound();

  const posts = await db.scheduledPost.findMany({
    where: { clientId },
    orderBy: { scheduledAt: "desc" },
    include: { createdBy: true },
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Link href={`/clients/${clientId}`} className="inline-flex items-center text-sm text-tinta-3 hover:text-tinta">
        <ArrowLeft className="mr-1.5 size-4" strokeWidth={1.5} />
        {client.name}
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <h1 className="display text-3xl">Posts agendados</h1>
        <Button asChild>
          <Link href={`/clients/${clientId}/posts/novo`}>
            <Plus className="mr-1.5 size-4" strokeWidth={1.5} />
            Agendar post
          </Link>
        </Button>
      </div>

      <div className="cartao mt-8 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-linha bg-linha-2 text-left">
            <tr>
              <th className="p-3">Canal</th>
              <th className="p-3">Formato</th>
              <th className="p-3">Legenda</th>
              <th className="p-3">Agendado para</th>
              <th className="p-3">Publicado em</th>
              <th className="p-3">Responsável</th>
              <th className="p-3">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {posts.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-tinta-3">
                  Nenhum post agendado ainda.
                </td>
              </tr>
            )}
            {posts.map((post) => (
              <tr key={post.id} className="border-b border-linha-2">
                <td className="p-3">{CHANNEL_LABEL[post.channel]}</td>
                <td className="p-3">{FORMAT_LABEL[post.format]}</td>
                <td className="max-w-xs truncate p-3">{post.caption || "(sem legenda)"}</td>
                <td className="p-3 whitespace-nowrap">{post.scheduledAt.toLocaleString("pt-BR")}</td>
                <td className="p-3 whitespace-nowrap">{post.publishedAt?.toLocaleString("pt-BR") ?? "—"}</td>
                <td className="p-3">{post.createdBy.name}</td>
                <td className="p-3">
                  <Badge variant={post.status === "PUBLISHED" ? "default" : post.status === "ERROR" ? "outline" : "secondary"}>
                    {STATUS_LABEL[post.status]}
                  </Badge>
                  {post.errorMessage && <p className="mt-1 text-xs text-alerta">{post.errorMessage}</p>}
                  {post.permalink && (
                    <a href={post.permalink} target="_blank" rel="noreferrer" className="mt-1 block text-xs text-mata underline">
                      Ver publicação
                    </a>
                  )}
                </td>
                <td className="p-3">
                  {post.status === "SCHEDULED" && (
                    <form action={cancelScheduledPostAction.bind(null, clientId, post.id)}>
                      <Button type="submit" variant="ghost" size="sm">
                        Cancelar
                      </Button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
