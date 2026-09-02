"use client";

import { useState } from "react";
import Link from "next/link";
import { Archive, ArchiveRestore, Check, Instagram, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  edicaoRapidaAction,
  arquivarClienteAction,
  desarquivarClienteAction,
  type ClienteNaLista,
} from "@/app/(dashboard)/clients/actions";

// Uma linha da guia Clientes. A edição abre na própria linha em vez de navegar: o caso
// de uso é corrigir uma sigla, e ir e voltar de tela para isso é o que a guia existe
// para evitar. O cadastro completo continua em Editar cliente.
export function LinhaDeCliente({
  cliente,
  redatores,
  podeEditar,
}: {
  cliente: ClienteNaLista;
  redatores: { id: string; name: string }[];
  podeEditar: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const arquivado = cliente.archivedAt !== null;

  async function salvar(dados: FormData) {
    setErro(null);
    setSalvando(true);
    try {
      await edicaoRapidaAction(cliente.id, dados);
      setEditando(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function alternarArquivo() {
    setErro(null);
    setSalvando(true);
    try {
      if (arquivado) await desarquivarClienteAction(cliente.id);
      else await arquivarClienteAction(cliente.id);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível arquivar.");
    } finally {
      setSalvando(false);
    }
  }

  if (editando) {
    return (
      <form action={salvar} className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="rotulo" htmlFor={`sigla-${cliente.id}`}>
              Sigla
            </label>
            <Input
              id={`sigla-${cliente.id}`}
              name="acronym"
              defaultValue={cliente.acronym ?? ""}
              maxLength={5}
              required
              className="w-[90px] font-mono"
            />
          </div>

          <div className="min-w-[200px] flex-1 space-y-1">
            <label className="rotulo" htmlFor={`nome-${cliente.id}`}>
              Nome
            </label>
            <Input id={`nome-${cliente.id}`} name="name" defaultValue={cliente.name} required />
          </div>

          <div className="space-y-1">
            <label className="rotulo" htmlFor={`resp-${cliente.id}`}>
              Responsável
            </label>
            <select
              id={`resp-${cliente.id}`}
              name="ownerId"
              defaultValue={cliente.ownerId ?? ""}
              className="block w-[170px] rounded-controle border border-linha bg-carta px-3 py-1.5 text-sm shadow-carta"
            >
              <option value="">Sem responsável</option>
              {redatores.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <Button type="submit" size="sm" disabled={salvando}>
            <Check className="mr-1.5 size-4" strokeWidth={1.5} />
            {salvando ? "Salvando" : "Salvar"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditando(false)} disabled={salvando}>
            <X className="mr-1.5 size-4" strokeWidth={1.5} />
            Cancelar
          </Button>
        </div>
        {erro && <p className="mt-2 text-xs text-risco">{erro}</p>}
      </form>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 p-4 ${arquivado ? "opacity-55" : ""}`}>
      <span className="w-[52px] shrink-0 font-mono text-xs text-tinta-3">{cliente.acronym ?? "—"}</span>

      <Link href={`/clients/${cliente.id}`} className="min-w-[160px] font-medium hover:text-mata">
        {cliente.name}
      </Link>

      {arquivado && (
        <span className="rounded-controle border border-linha px-2 py-0.5 text-[10px] uppercase text-tinta-3">
          Arquivado
        </span>
      )}

      <span className="min-w-[140px] flex-1 truncate text-sm text-tinta-3">{cliente.niche}</span>

      <span className="w-[130px] shrink-0 truncate text-sm text-tinta-3">
        {cliente.ownerName ?? "sem responsável"}
      </span>

      <span className="w-[110px] shrink-0 truncate text-xs text-tinta-3">{cliente.squadName ?? "sem squad"}</span>

      <span className="w-[24px] shrink-0" title={cliente.temInstagram ? "Instagram conectado" : "Sem conexão"}>
        <Instagram
          className={`size-4 ${cliente.temInstagram ? "text-mata" : "text-linha"}`}
          strokeWidth={1.5}
        />
      </span>

      {podeEditar && (
        <div className="flex shrink-0 gap-1">
          <Button type="button" size="icon" variant="ghost" onClick={() => setEditando(true)} aria-label={`Editar ${cliente.name}`}>
            <Pencil className="size-4" strokeWidth={1.5} />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={alternarArquivo}
            disabled={salvando}
            aria-label={arquivado ? `Desarquivar ${cliente.name}` : `Arquivar ${cliente.name}`}
          >
            {arquivado ? (
              <ArchiveRestore className="size-4" strokeWidth={1.5} />
            ) : (
              <Archive className="size-4" strokeWidth={1.5} />
            )}
          </Button>
        </div>
      )}

      {erro && <p className="w-full text-xs text-risco">{erro}</p>}
    </div>
  );
}
