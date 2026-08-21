import Link from "next/link";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireClientAccess } from "@/lib/auth/guards";
import { getScheduledFacebookPosts } from "@/lib/meta/graph";

// Esta tela mostra o estado atual dos agendamentos no Meta, então nunca pode servir
// resposta guardada: no Next 14 o fetch entra no Data Cache por padrão, o que faria um
// post recém-agendado não aparecer (ou um já removido continuar na lista).
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function MetaScheduledPostsPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  await requireClientAccess(clientId);

  const client = await db.client.findUnique({ where: { id: clientId } });
  if (!client) notFound();

  const account = await db.instagramAccount.findUnique({ where: { clientId } });

  let posts: Awaited<ReturnType<typeof getScheduledFacebookPosts>> = [];
  let loadError: string | null = null;

  if (account?.pageId) {
    try {
      posts = await getScheduledFacebookPosts(account.pageId, account.pageAccessToken);
    } catch (err) {
      loadError = err instanceof Error ? err.message : "Erro ao consultar os agendamentos no Meta.";
    }
  }

  const lastDate = posts.at(-1)?.scheduledPublishTime;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link href={`/clients/${clientId}`} className="inline-flex items-center text-sm text-tinta-3 hover:text-tinta">
        <ArrowLeft className="mr-1.5 size-4" strokeWidth={1.5} />
        {client.name}
      </Link>

      <div className="mt-4">
        <h1 className="display text-3xl">Agendamentos no Meta</h1>
        <p className="mt-1 text-sm text-tinta-3">
          Espelho, somente leitura, dos posts que já estão agendados de verdade direto no Meta (Business Suite ou
          outra ferramenta) para a Página do Facebook conectada — não é possível criar ou editar agendamentos aqui.
        </p>
      </div>

      {!account?.pageId && (
        <div className="cartao mt-8 p-8 text-center text-sm text-tinta-3">
          Conecte o Facebook do cliente na{" "}
          <Link href={`/clients/${clientId}/contexto`} className="text-mata underline">
            aba de Contexto
          </Link>{" "}
          para ver os agendamentos aqui.
        </div>
      )}

      {account?.pageId && (
        <div className="mt-6 flex items-start gap-2 rounded-controle border border-linha bg-linha-2 p-4 text-sm text-tinta-3">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} />
          <p>
            O Instagram não entra aqui: o Meta não abre API pública para consultar posts agendados do Instagram
            (só o app do Business Suite tem esse acesso internamente). Pra saber o que tem agendado no Instagram de{" "}
            {client.name}, confira direto no Meta Business Suite.
          </p>
        </div>
      )}

      {loadError && (
        <div className="cartao mt-6 border-alerta/40 p-4 text-sm text-alerta">{loadError}</div>
      )}

      {account?.pageId && !loadError && (
        <>
          {lastDate && (
            <p className="mt-6 text-sm text-tinta-3">
              Facebook ({account.pageName}) tem posts agendados até{" "}
              <strong className="text-tinta">{new Date(lastDate).toLocaleString("pt-BR")}</strong>.
            </p>
          )}

          <div className="cartao mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-linha bg-linha-2 text-left">
                <tr>
                  <th className="p-3">Agendado para</th>
                  <th className="p-3">Mensagem</th>
                  <th className="p-3">Criado em</th>
                </tr>
              </thead>
              <tbody>
                {posts.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-6 text-center text-tinta-3">
                      Nenhum post agendado no momento no Facebook ({account.pageName}).
                    </td>
                  </tr>
                )}
                {posts.map((post) => (
                  <tr key={post.id} className="border-b border-linha-2">
                    <td className="p-3 whitespace-nowrap">{new Date(post.scheduledPublishTime).toLocaleString("pt-BR")}</td>
                    <td className="max-w-md truncate p-3">{post.message || "(sem texto)"}</td>
                    <td className="p-3 whitespace-nowrap">{new Date(post.createdTime).toLocaleString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
