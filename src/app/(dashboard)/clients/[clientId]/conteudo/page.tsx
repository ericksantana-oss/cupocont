import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireClientAccess } from "@/lib/auth/guards";
import { currentPeriod } from "@/lib/periodo";
import { PeriodSelect } from "@/components/client/PeriodSelect";
import { TabNav } from "@/components/client/TabNav";
import { ContextTab } from "@/components/client/ContextTab";
import { KeywordsTab } from "@/components/client/KeywordsTab";
import { BriefingTab } from "@/components/client/BriefingTab";
import { ThemesTab } from "@/components/client/ThemesTab";
import { TextsTab } from "@/components/client/TextsTab";

export default async function ClientContentPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ tab?: string; period?: string }>;
}) {
  const { clientId } = await params;
  const { tab = "contexto", period = currentPeriod() } = await searchParams;

  await requireClientAccess(clientId);

  const client = await db.client.findUnique({ where: { id: clientId } });
  if (!client) notFound();

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Link href={`/clients/${clientId}`} className="inline-flex items-center text-sm text-tinta-3 hover:text-tinta">
        <ArrowLeft className="mr-1.5 size-4" strokeWidth={1.5} />
        {client.name}
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="display text-3xl">Conteúdo para redes sociais</h1>
          <p className="mt-1 text-sm text-tinta-3">{client.niche}</p>
        </div>
        <PeriodSelect period={period} />
      </div>

      <div className="mt-8">
        <TabNav clientId={clientId} period={period} activeTab={tab} />
        <div className="mt-6">
          {tab === "contexto" && <ContextTab clientId={clientId} />}
          {tab === "keywords" && <KeywordsTab clientId={clientId} period={period} />}
          {tab === "briefing" && <BriefingTab clientId={clientId} period={period} />}
          {tab === "temas" && <ThemesTab clientId={clientId} period={period} />}
          {tab === "textos" && <TextsTab clientId={clientId} period={period} />}
        </div>
      </div>
    </div>
  );
}
