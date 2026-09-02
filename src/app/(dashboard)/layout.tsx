import Link from "next/link";
import { Building2, CalendarDays, Home, LayoutDashboard, LogOut, Search, Users, Users2 } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { SidebarNav, type NavItem } from "@/components/layout/SidebarNav";
import { CupolaMark } from "@/components/CupolaMark";
import { logoutAction } from "./logout-action";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  const workspaceItems: NavItem[] =
    user.role === "ADMIN"
      ? [
          {
            href: "/admin",
            label: "Painel admin",
            icon: <LayoutDashboard className="size-4" strokeWidth={1.5} />,
            matchPrefix: true,
          },
          { href: "/users", label: "Usuários", icon: <Users className="size-4" strokeWidth={1.5} /> },
          { href: "/squads", label: "Squads", icon: <Users2 className="size-4" strokeWidth={1.5} /> },
        ]
      : [];

  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex min-h-screen">
      <aside className="sup-poco grao-minimo flex w-64 shrink-0 flex-col px-4 py-5 text-papel">
        <Link href="/clients" className="relative z-10 mb-6 flex items-center gap-2.5 px-1">
          <CupolaMark className="size-6" />
          <span className="display text-base">CupoCont</span>
        </Link>

        <div className="relative z-10">
          <SidebarNav
            items={[
              { href: "/clients", label: "Início", icon: <Home className="size-4" strokeWidth={1.5} /> },
              { href: "/clientes", label: "Clientes", icon: <Building2 className="size-4" strokeWidth={1.5} /> },
              {
                href: "/agendamentos",
                label: "Posts agendados",
                icon: <CalendarDays className="size-4" strokeWidth={1.5} />,
                matchPrefix: true,
              },
              { href: "/busca", label: "Buscar conteúdo", icon: <Search className="size-4" strokeWidth={1.5} /> },
            ]}
          />
        </div>

        {workspaceItems.length > 0 && (
          <div className="relative z-10 mt-6">
            <p className="rotulo mb-1.5 px-3 !text-papel/40">Workspace</p>
            <SidebarNav items={workspaceItems} />
          </div>
        )}

        <div className="relative z-10 mt-auto flex items-center gap-3 border-t border-papel/10 pt-4">
          <Link href="/profile" className="flex min-w-0 flex-1 items-center gap-3 rounded-controle p-1 hover:bg-papel/[0.06]">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-neon text-xs font-semibold text-poco">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-papel/50">
                {user.role === "ADMIN" ? "Admin" : user.role === "INTERN" ? "Estagiário" : "Redator"}
              </p>
            </div>
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              aria-label="Sair"
              className="flex size-8 items-center justify-center rounded-controle text-papel/60 hover:bg-papel/10 hover:text-papel"
            >
              <LogOut className="size-4" strokeWidth={1.5} />
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-papel">{children}</main>
    </div>
  );
}
