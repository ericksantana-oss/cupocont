import { requireAdmin } from "@/lib/auth/guards";
import { AdminTabNav } from "@/components/admin/AdminTabNav";
import { formatDateTime } from "@/lib/formatDate";
import { ACTIVITY_LABELS } from "@/lib/activity";
import type { ActivityAction } from "@prisma/client";
import { getActivityFeed } from "../actions";

export default async function AdminHistoryPage() {
  await requireAdmin();
  const feed = await getActivityFeed(100);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="display text-3xl">Painel admin</h1>
      <p className="mt-1 text-sm text-tinta-3">Últimas ações realizadas na ferramenta.</p>

      <div className="mt-8">
        <AdminTabNav active="/admin/historico" />
        <div className="cartao mt-6 divide-y divide-linha-2">
          {feed.length === 0 && <p className="p-6 text-sm text-tinta-3">Nenhuma atividade registrada ainda.</p>}
          {feed.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
              <span className="w-36 shrink-0 text-xs text-tinta-3">{formatDateTime(item.createdAt)}</span>
              <span className="font-medium">{item.userName}</span>
              <span className="text-tinta-3">·</span>
              <span>{ACTIVITY_LABELS[item.action as ActivityAction]}</span>
              {item.detail && <span className="truncate text-tinta-2">— {item.detail}</span>}
              <span className="ml-auto shrink-0 text-xs text-tinta-3">{item.clientName}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
