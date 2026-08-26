import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireClientAccess } from "@/lib/auth/guards";
import { ContextTab } from "@/components/client/ContextTab";
import { ClientRulesCard } from "@/components/client/ClientRulesCard";

export default async function ClientContextPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  await requireClientAccess(clientId);

  const client = await db.client.findUnique({ where: { id: clientId } });
  if (!client) notFound();

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Link href={`/clients/${clientId}`} className="inline-flex items-center text-sm text-tinta-3 hover:text-tinta">
        <ArrowLeft className="mr-1.5 size-4" strokeWidth={1.5} />
        {client.name}
      </Link>

      <div className="mt-4">
        <h1 className="display text-3xl">Contexto do cliente</h1>
        <p className="mt-1 text-sm text-tinta-3">
          Base de conhecimento e redes conectadas — usado como referência em qualquer tipo de conteúdo gerado para
          este cliente (redes sociais, e-mails, etc).
        </p>
      </div>

      <div className="mt-8">
        <ContextTab clientId={clientId} />
      </div>

      <div className="mt-6">
        <ClientRulesCard clientId={clientId} />
      </div>
    </div>
  );
}
