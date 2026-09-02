"use client";

import { useState, useTransition } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, GripVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { agendarPostAction, desagendarPostAction } from "@/app/(dashboard)/agendamentos/actions";

// Arrastar e soltar em HTML5 puro, sem biblioteca.
//
// Motivo: o projeto não tem nenhuma lib de drag-and-drop e as conhecidas pesam mais que
// a tela inteira. Em troca, arrastar não funciona em toque — então todo cartão também
// tem um seletor de data, que faz a mesma coisa por clique. A tela precisa funcionar
// sem arrastar; arrastar é o atalho, não o único caminho.

const DIAS_DA_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export interface PostParaAgendar {
  themeId: string;
  titulo: string;
  clientName: string;
  clientId: string;
  dia: string | null; // "2026-09-14" quando já tem agendamento registrado
}

export function CalendarioAgendamento({
  period,
  diasNoMes,
  primeiroDiaDaSemana,
  posts,
  mesLabel,
  linkMesAnterior,
  linkMesSeguinte,
  corPorCliente,
}: {
  period: string;
  diasNoMes: number;
  primeiroDiaDaSemana: number;
  posts: PostParaAgendar[];
  mesLabel: string;
  linkMesAnterior: string;
  linkMesSeguinte: string;
  corPorCliente: Record<string, string>;
}) {
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [diaAlvo, setDiaAlvo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const naoAgendados = posts.filter((p) => p.dia === null);

  const chaveDoDia = (dia: number) => `${period}-${String(dia).padStart(2, "0")}`;

  function mover(themeId: string, dia: string) {
    setErro(null);
    iniciar(async () => {
      try {
        await agendarPostAction({ themeId, dia });
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Não foi possível registrar o agendamento.");
      }
    });
  }

  function remover(themeId: string) {
    setErro(null);
    iniciar(async () => {
      try {
        await desagendarPostAction(themeId);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Não foi possível remover o agendamento.");
      }
    });
  }

  function Cartao({ post, compacto }: { post: PostParaAgendar; compacto?: boolean }) {
    const cor = corPorCliente[post.clientId] ?? "bg-bruma/40";
    return (
      <div
        draggable={!pendente}
        onDragStart={() => setArrastando(post.themeId)}
        onDragEnd={() => {
          setArrastando(null);
          setDiaAlvo(null);
        }}
        className={`group flex items-start gap-1.5 rounded-controle border border-linha-2 ${cor} p-2 text-left ${
          arrastando === post.themeId ? "opacity-40" : ""
        } ${pendente ? "" : "cursor-grab active:cursor-grabbing"}`}
        title={post.titulo}
      >
        <GripVertical className="mt-0.5 size-3 shrink-0 text-tinta-3" strokeWidth={1.5} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium leading-tight">{post.titulo}</p>
          {!compacto && <p className="mt-0.5 truncate text-[10px] text-tinta-3">{post.clientName}</p>}
        </div>
        {post.dia && (
          <button
            type="button"
            onClick={() => remover(post.themeId)}
            aria-label={`Remover agendamento de ${post.titulo}`}
            className="opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
          >
            <X className="size-3 text-tinta-3 hover:text-risco" strokeWidth={1.5} />
          </button>
        )}
      </div>
    );
  }

  // Células vazias antes do dia 1, para o mês começar no dia da semana certo.
  const celulasVazias = Array.from({ length: primeiroDiaDaSemana });
  const dias = Array.from({ length: diasNoMes }, (_, i) => i + 1);
  const ultimoDia = String(diasNoMes).padStart(2, "0");

  return (
    <div>
      {erro && <p className="mb-4 rounded-controle border border-risco/40 bg-risco/10 p-3 text-sm">{erro}</p>}

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div>
          <h2 className="rotulo">Ainda não agendados ({naoAgendados.length})</h2>
          <div className="cartao mt-3 space-y-2 p-3">
            {naoAgendados.length === 0 ? (
              <p className="p-2 text-sm text-tinta-3">
                Todos os posts das demandas selecionadas já têm dia registrado.
              </p>
            ) : (
              naoAgendados.map((post) => (
                <div key={post.themeId} className="space-y-1.5">
                  <Cartao post={post} />
                  {/* Caminho sem arrastar: funciona no toque e para quem prefere teclado. */}
                  <div className="flex items-center gap-1.5 pl-5 text-[10px] text-tinta-3">
                    <input
                      type="date"
                      aria-label={`Data do agendamento de ${post.titulo}`}
                      min={`${period}-01`}
                      max={`${period}-${ultimoDia}`}
                      onChange={(e) => e.target.value && mover(post.themeId, e.target.value)}
                      className="rounded border border-linha bg-carta px-1.5 py-0.5 text-[10px]"
                    />
                    <span>ou arraste para um dia</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="size-4 text-tinta-3" strokeWidth={1.5} />
              <h2 className="text-lg font-semibold">{mesLabel}</h2>
            </div>
            <div className="flex gap-1">
              <a href={linkMesAnterior}>
                <Button type="button" variant="ghost" size="sm" aria-label="Mês anterior">
                  <ChevronLeft className="size-4" strokeWidth={1.5} />
                </Button>
              </a>
              <a href={linkMesSeguinte}>
                <Button type="button" variant="ghost" size="sm" aria-label="Mês seguinte">
                  <ChevronRight className="size-4" strokeWidth={1.5} />
                </Button>
              </a>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1">
            {DIAS_DA_SEMANA.map((nome) => (
              <div key={nome} className="pb-1 text-center text-[10px] font-medium uppercase text-tinta-3">
                {nome}
              </div>
            ))}

            {celulasVazias.map((_, i) => (
              <div key={`vazio-${i}`} />
            ))}

            {dias.map((dia) => {
              const chave = chaveDoDia(dia);
              const doDia = posts.filter((p) => p.dia === chave);
              return (
                <div
                  key={dia}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDiaAlvo(chave);
                  }}
                  onDragLeave={() => setDiaAlvo((atual) => (atual === chave ? null : atual))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDiaAlvo(null);
                    if (arrastando) mover(arrastando, chave);
                    setArrastando(null);
                  }}
                  className={`min-h-[92px] rounded-controle border p-1.5 transition-colors ${
                    diaAlvo === chave ? "border-mata bg-mata/10" : "border-linha-2 bg-carta"
                  }`}
                >
                  <span className="block text-[10px] font-medium text-tinta-3">{dia}</span>
                  <div className="mt-1 space-y-1">
                    {doDia.map((post) => (
                      <Cartao key={post.themeId} post={post} compacto />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
