import { Instagram, RefreshCw, Unlink } from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/formatDate";
import {
  syncInstagramAction,
  disconnectInstagramAction,
  chooseInstagramAccountAction,
} from "@/app/(dashboard)/clients/[clientId]/actions";

export async function InstagramCard({ clientId }: { clientId: string }) {
  const [account, pending] = await Promise.all([
    db.instagramAccount.findUnique({ where: { clientId } }),
    db.instagramPendingSelection.findFirst({ where: { clientId }, orderBy: { createdAt: "desc" } }),
  ]);

  if (pending) {
    const candidates = pending.candidates as { pageName: string; igUserId: string; igUsername: string | null }[];
    const chooseAction = chooseInstagramAccountAction.bind(null, clientId);

    return (
      <div className="cartao p-6">
        <h2 className="text-lg font-semibold">Qual conta é do cliente?</h2>
        <p className="mt-1 text-sm text-tinta-3">
          Encontramos mais de uma Página do Facebook com Instagram vinculado na conta autorizada. Escolha qual
          pertence a este cliente.
        </p>
        <div className="mt-4 space-y-2">
          {candidates.map((c) => (
            <form key={c.igUserId} action={chooseAction} className="flex items-center justify-between gap-3 rounded-controle border border-linha p-3">
              <input type="hidden" name="selectionId" value={pending.id} />
              <input type="hidden" name="igUserId" value={c.igUserId} />
              <div className="text-sm">
                <span className="font-medium">@{c.igUsername ?? "sem username"}</span>
                <span className="ml-2 text-tinta-3">(página: {c.pageName})</span>
              </div>
              <Button type="submit" size="sm">
                Usar esta conta
              </Button>
            </form>
          ))}
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="cartao p-6">
        <h2 className="text-lg font-semibold">Instagram</h2>
        <p className="mt-1 text-sm text-tinta-3">
          Conecte a conta comercial do Instagram do cliente para trazer os posts com melhor engajamento e métricas
          básicas como contexto extra para a geração de temas.
        </p>
        <a href={`/api/meta/connect?clientId=${clientId}`}>
          <Button type="button" className="mt-4">
            <Instagram className="mr-1.5 size-4" strokeWidth={1.5} />
            Conectar Instagram
          </Button>
        </a>
      </div>
    );
  }

  const syncAction = syncInstagramAction.bind(null, clientId);
  const disconnectAction = disconnectInstagramAction.bind(null, clientId);

  return (
    <div className="cartao p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Instagram conectado</h2>
          <p className="mt-1 text-sm text-tinta-3">
            @{account.igUsername ?? "conta conectada"}
            {account.lastSyncedAt && ` — última atualização ${formatDateTime(account.lastSyncedAt)}`}
          </p>
        </div>
        <div className="flex gap-2">
          <form action={syncAction}>
            <Button type="submit" variant="secondary">
              <RefreshCw className="mr-1.5 size-4" strokeWidth={1.5} />
              Atualizar métricas agora
            </Button>
          </form>
          <form action={disconnectAction}>
            <Button type="submit" variant="ghost">
              <Unlink className="mr-1.5 size-4" strokeWidth={1.5} />
              Desconectar
            </Button>
          </form>
        </div>
      </div>

      {account.summary ? (
        <pre className="sup-poco mt-4 whitespace-pre-wrap rounded-controle p-4 text-sm">{account.summary}</pre>
      ) : (
        <p className="mt-4 text-sm text-tinta-3">
          Ainda não há métricas sincronizadas. Clique em &quot;Atualizar métricas agora&quot;.
        </p>
      )}
    </div>
  );
}
