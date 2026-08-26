import Link from "next/link";
import { Search, ArrowRight } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { periodLabel } from "@/lib/periodo";
import { buscarConteudo } from "@/lib/contentSearch";

export default async function BuscaPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const { q = "" } = await searchParams;

  const resultados = q.trim().length >= 3 ? await buscarConteudo(user, q) : [];

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="display text-3xl">Buscar conteúdo</h1>
      <p className="mt-1 text-sm text-tinta-3">
        Procura por sentido, não por palavra exata: buscar &ldquo;financiamento&rdquo; encontra um tema sobre
        condições de pagamento. Cobre tudo o que já foi produzido nos clientes a que você tem acesso.
      </p>

      <form action="/busca" className="mt-6">
        <div className="flex items-center gap-2 rounded-campo border border-linha bg-carta px-4 py-3 shadow-carta">
          <Search className="size-4 shrink-0 text-tinta-3" strokeWidth={1.5} />
          <Input
            name="q"
            defaultValue={q}
            placeholder="ex.: aquele post sobre financiamento, conteúdo sobre bairro, depoimento de morador..."
            className="border-none bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </div>
      </form>

      {q.trim().length > 0 && q.trim().length < 3 && (
        <p className="mt-6 text-sm text-tinta-3">Escreva pelo menos 3 caracteres.</p>
      )}

      {q.trim().length >= 3 && (
        <div className="mt-6">
          <p className="rotulo">
            {resultados.length === 0
              ? "Nada encontrado"
              : `${resultados.length} resultado(s) para "${q}"`}
          </p>

          {resultados.length === 0 && (
            <p className="mt-2 text-sm text-tinta-3">
              Nenhum tema produzido se aproxima disso. Vale tentar com outras palavras — a busca compara sentido,
              então descrever o assunto costuma funcionar melhor que um termo isolado.
            </p>
          )}

          <div className="mt-3 space-y-3">
            {resultados.map((r) => (
              <Link
                key={r.themeId}
                href={`/clients/${r.clientId}/conteudo?tab=textos&period=${r.period}`}
                className="cartao block p-5 transition-shadow hover:shadow-alto"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-mata">{r.clientName}</span>
                  <span className="text-tinta-3">·</span>
                  <span className="text-sm text-tinta-3">{periodLabel(r.period)}</span>
                  {r.textStatus && (
                    <Badge variant={r.textStatus === "APPROVED" ? "default" : "secondary"}>
                      {r.textStatus === "APPROVED" ? "aprovado" : "rascunho"}
                    </Badge>
                  )}
                  <span className="ml-auto text-xs tabular-nums text-tinta-3">
                    {(r.semelhanca * 100).toFixed(0)}%
                  </span>
                </div>

                <h3 className="mt-2 font-semibold leading-snug">{r.title}</h3>

                {r.textPreview ? (
                  <p className="mt-2 line-clamp-2 text-sm text-tinta-2">{r.textPreview}</p>
                ) : (
                  <p className="mt-2 text-sm text-tinta-3">Texto ainda não gerado.</p>
                )}

                <span className="mt-3 inline-flex items-center text-sm font-medium text-mata">
                  Abrir
                  <ArrowRight className="ml-1 size-4" strokeWidth={1.5} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
