import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "contexto", label: "1. Contexto" },
  { key: "keywords", label: "2. Palavras-chave" },
  { key: "briefing", label: "3. Briefing" },
  { key: "temas", label: "4. Temas" },
  { key: "textos", label: "5. Textos" },
];

export function TabNav({ clientId, period, activeTab }: { clientId: string; period: string; activeTab: string }) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-linha">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={`/clients/${clientId}/conteudo?tab=${tab.key}&period=${period}`}
          className={cn(
            "rounded-t-controle px-3 py-2 text-sm font-medium transition-colors",
            activeTab === tab.key ? "border-b-2 border-mata text-mata" : "text-tinta-3 hover:text-tinta"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
