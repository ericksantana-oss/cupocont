import Link from "next/link";
import { ArrowLeft, ArrowRight, BarChart3, BookOpen, GitBranch, Mail, Pencil, Sparkles } from "lucide-react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireClientAccess } from "@/lib/auth/guards";
import { Button } from "@/components/ui/button";

export default async function ClientSelectorPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const user = await requireClientAccess(clientId);

  const client = await db.client.findUnique({ where: { id: clientId } });
  if (!client) notFound();

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/clients" className="inline-flex items-center text-sm text-tinta-3 hover:text-tinta">
        <ArrowLeft className="mr-1.5 size-4" strokeWidth={1.5} />
        Clientes
      </Link>

      <div className="mt-4 flex items-center gap-2">
        <h1 className="display text-3xl">{client.name}</h1>
        {user.role === "ADMIN" && (
          <Button asChild variant="ghost" size="icon">
            <Link href={`/clients/${clientId}/edit`} aria-label="Editar cliente">
              <Pencil className="size-4" strokeWidth={1.5} />
            </Link>
          </Button>
        )}
      </div>
      <p className="mt-1 text-sm text-tinta-3">{client.niche}</p>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        <Link href={`/clients/${clientId}/contexto`} className="inline-flex items-center text-sm font-medium text-mata">
          <BookOpen className="mr-1.5 size-4" strokeWidth={1.5} />
          Contexto do cliente (base de conhecimento + redes conectadas)
          <ArrowRight className="ml-1 size-4" strokeWidth={1.5} />
        </Link>
        <Link href={`/clients/${clientId}/dashboard`} className="inline-flex items-center text-sm font-medium text-mata">
          <BarChart3 className="mr-1.5 size-4" strokeWidth={1.5} />
          Dashboard de resultados
          <ArrowRight className="ml-1 size-4" strokeWidth={1.5} />
        </Link>
      </div>

      <p className="mt-10 rotulo">O que você vai produzir?</p>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <ChoiceCard
          href={`/clients/${clientId}/conteudo`}
          icon={<Sparkles className="size-5 text-mata" strokeWidth={1.5} />}
          title="Conteúdo para redes sociais"
          description="Palavras-chave, briefing, temas e textos do mês."
        />
        <ChoiceCard
          href={`/clients/${clientId}/emails/novo?type=pontual`}
          icon={<Mail className="size-5 text-mata" strokeWidth={1.5} />}
          title="Disparo de e-mail pontual"
          description="Um e-mail avulso, gerado a partir de um mini-briefing."
        />
        <ChoiceCard
          href={`/clients/${clientId}/emails/novo?type=fluxo`}
          icon={<GitBranch className="size-5 text-mata" strokeWidth={1.5} />}
          title="Fluxo de e-mail"
          description="E-mail de um fluxo já planejado, mantendo continuidade com os anteriores."
        />
      </div>

      <Link
        href={`/clients/${clientId}/emails`}
        className="mt-6 inline-flex items-center text-sm font-medium text-mata"
      >
        Ver histórico de e-mails
        <ArrowRight className="ml-1 size-4" strokeWidth={1.5} />
      </Link>
    </div>
  );
}

function ChoiceCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} className="cartao group p-6 transition-shadow hover:shadow-alto">
      <span className="flex size-10 items-center justify-center rounded-controle bg-bruma/25">{icon}</span>
      <h2 className="mt-4 font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-tinta-3">{description}</p>
    </Link>
  );
}
