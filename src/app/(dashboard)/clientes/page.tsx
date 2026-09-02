import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { LinhaDeCliente } from "@/components/client/LinhaDeCliente";
import { listarClientesParaGestao } from "../clients/actions";

// Tela de estado atual: mostra o que está no banco agora.
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ arquivados?: string }>;
}) {
  const user = await requireUser();
  const { arquivados } = await searchParams;
  const incluirArquivados = arquivados === "1";

  const podeEditar = user.role === "ADMIN";

  const [clientes, redatores] = await Promise.all([
    listarClientesParaGestao(incluirArquivados),
    // A edição rápida é só para admin, então a lista de responsáveis só é buscada
    // quando serve para algo.
    podeEditar
      ? db.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
      : Promise.resolve([]),
  ]);

  const ativos = clientes.filter((c) => c.archivedAt === null).length;
  const arquivadosNaLista = clientes.length - ativos;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-3xl">Clientes</h1>
          <p className="mt-1 text-sm text-tinta-3">
            {ativos} ativo(s)
            {incluirArquivados && arquivadosNaLista > 0 && ` · ${arquivadosNaLista} arquivado(s)`}
            {podeEditar && " · clique no lápis para corrigir sigla, nome ou responsável sem sair da tela"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href={incluirArquivados ? "/clientes" : "/clientes?arquivados=1"}>
            <Button type="button" variant="secondary" size="sm">
              {incluirArquivados ? "Esconder arquivados" : "Mostrar arquivados"}
            </Button>
          </Link>
          {podeEditar && (
            <Link href="/clients/new">
              <Button type="button" size="sm">
                <Plus className="mr-1.5 size-4" strokeWidth={1.5} />
                Novo cliente
              </Button>
            </Link>
          )}
        </div>
      </div>

      {clientes.length === 0 ? (
        <div className="cartao mt-6 p-6">
          <p className="text-sm text-tinta-3">Nenhum cliente para mostrar.</p>
        </div>
      ) : (
        <div className="cartao mt-6 divide-y divide-linha-2">
          {clientes.map((cliente) => (
            <LinhaDeCliente
              key={cliente.id}
              cliente={cliente}
              redatores={redatores}
              podeEditar={podeEditar}
            />
          ))}
        </div>
      )}

      {podeEditar && (
        <p className="mt-6 text-xs text-tinta-3">
          Arquivar tira o cliente da operação — ele sai desta lista, dos alertas e do calendário de
          agendamento, mas nada é apagado. É de propósito que não existe excluir aqui: excluir levaria
          junto os meses de métricas congeladas, que o Meta já descartou da API e não devolve nem
          reconectando a conta.
        </p>
      )}
    </div>
  );
}
