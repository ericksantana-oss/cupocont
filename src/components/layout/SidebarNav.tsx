"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  matchPrefix?: boolean;
};

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-0.5 text-sm">
      {items.map((item) => {
        const isActive = item.matchPrefix ? pathname.startsWith(item.href) : pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2.5 rounded-controle px-3 py-2 transition-colors",
              isActive ? "bg-papel/10 text-papel" : "text-papel/70 hover:bg-papel/[0.06] hover:text-papel"
            )}
          >
            {item.icon}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
