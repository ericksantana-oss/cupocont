import Link from "next/link";
import { ArrowLeft, GitBranch, Mail, Plus } from "lucide-react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireClientAccess } from "@/lib/auth/guards";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/formatDate";
import { listEmails } from "./actions";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Rascunho",
  REVIEW: "Em revisão",
  APPROVED: "Aprovado",
};

const STATUS_VARIANT: Record<string, "secondary" | "default"> = {
  DRAFT: "secondary",
  REVIEW: "secondary",
  APPROVED: "default",
};

export default async function EmailsHistoryPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  await requireClientAccess(clientId);

  const [client, emails] = await Promise.all([
    db.client.findUnique({ where: { id: clientId } }),
    listEmails(clientId),
  ]);
  if (!client) notFound();

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Link href={`/clients/${clientId}`} className="inline-flex items-center text-sm text-tinta-3 hover:text-tinta">
        <ArrowLeft className="mr-1.5 size-4" strokeWidth={1.5} />
        {client.name}
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-3xl">E-mails</h1>
          <p className="mt-1 text-sm text-tinta-3">Histórico de disparos pontuais e de fluxo.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/clients/${clientId}/emails/novo?type=pontual`}>
              <Mail className="mr-1.5 size-4" strokeWidth={1.5} />
              Novo disparo pontual
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/clients/${clientId}/emails/novo?type=fluxo`}>
              <GitBranch className="mr-1.5 size-4" strokeWidth={1.5} />
              Novo e-mail de fluxo
            </Link>
          </Button>
        </div>
      </div>

      <div className="cartao mt-6 divide-y divide-linha-2">
        {emails.length === 0 && (
          <p className="p-6 text-sm text-tinta-3">Nenhum e-mail criado ainda.</p>
        )}
        {emails.map((email) => (
          <Link
            key={email.id}
            href={`/clients/${clientId}/emails/${email.id}`}
            className="flex flex-wrap items-center gap-3 p-4 text-sm hover:bg-bruma/10"
          >
            <span className="font-medium">{email.name}</span>
            <Badge variant="secondary">{email.type === "PONTUAL" ? "Pontual" : "Fluxo"}</Badge>
            {email.flow && <span className="text-tinta-3">{email.flow.name}</span>}
            <span className="ml-auto text-xs text-tinta-3">{email.createdBy.name}</span>
            <span className="text-xs text-tinta-3">{formatDateTime(email.createdAt)}</span>
            <Badge variant={STATUS_VARIANT[email.status]}>{STATUS_LABEL[email.status]}</Badge>
          </Link>
        ))}
      </div>
    </div>
  );
}
