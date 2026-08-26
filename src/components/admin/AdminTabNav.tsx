import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin", label: "Clientes" },
  { href: "/admin/equipe", label: "Equipe" },
  { href: "/admin/desempenho", label: "Desempenho" },
  { href: "/admin/historico", label: "Histórico" },
];

export function AdminTabNav({ active }: { active: "/admin" | "/admin/equipe" | "/admin/desempenho" | "/admin/historico" }) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-linha">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={cn(
            "rounded-t-controle px-3 py-2 text-sm font-medium transition-colors",
            active === tab.href ? "border-b-2 border-mata text-mata" : "text-tinta-3 hover:text-tinta"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
