"use client";

import { useState } from "react";
import { PenLine, Plus, RefreshCw, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  CARD_IMAGE_TEXT_LIMIT,
  MAX_SLIDES,
  MAX_STORIES,
  SLIDE_ROLE_LABEL,
  derivarStories,
  normalizeSlideRoles,
  slideLimit,
  type PieceFormat,
  type Slide,
} from "@/lib/contentPiece";

function Contador({ atual, limite }: { atual: number; limite: number }) {
  const excedeu = atual > limite;
  return (
    <span className={`text-xs tabular-nums ${excedeu ? "font-semibold text-risco" : "text-tinta-3"}`}>
      {atual}/{limite}
      {excedeu && " — passou do limite"}
    </span>
  );
}

export function PieceFieldsEditor({
  action,
  pieceFormat,
  caption,
  imageText,
  slides,
  stories,
}: {
  action: (formData: FormData) => void;
  pieceFormat: PieceFormat | null;
  caption: string;
  imageText: string | null;
  slides: Slide[];
  stories: string[];
}) {
  const [legenda, setLegenda] = useState(caption);
  const [textoImagem, setTextoImagem] = useState(imageText ?? "");
  const [cards, setCards] = useState<Slide[]>(slides);
  const [sequencia, setSequencia] = useState<string[]>(stories);

  // Os papéis vêm da posição, igual ao que o servidor grava — o rótulo na tela
  // sempre bate com o que vai ser salvo, mesmo depois de adicionar ou remover.
  const cardsComPapel = normalizeSlideRoles(cards);

  function alterarCard(indice: number, texto: string) {
    setCards((atual) => atual.map((card, i) => (i === indice ? { ...card, text: texto } : card)));
  }

  function adicionarCard() {
    setCards((atual) => {
      if (atual.length >= MAX_SLIDES) return atual;
      // Entra antes do último, pra não empurrar o CTA do fim da sequência.
      const copia = [...atual];
      copia.splice(Math.max(copia.length - 1, 0), 0, { role: "INTERNO", text: "" });
      return copia;
    });
  }

  function removerCard(indice: number) {
    setCards((atual) => (atual.length <= 2 ? atual : atual.filter((_, i) => i !== indice)));
  }

  // Refaz a sequência a partir do que está NA TELA agora, não do que está salvo — a
  // pessoa pode ter acabado de mexer nos cards e ainda não ter salvado.
  function refazerStories() {
    setSequencia(derivarStories(pieceFormat, textoImagem, cardsComPapel));
  }

  function alterarStory(indice: number, texto: string) {
    setSequencia((atual) => atual.map((s, i) => (i === indice ? texto : s)));
  }

  function removerStory(indice: number) {
    setSequencia((atual) => atual.filter((_, i) => i !== indice));
  }

  function adicionarStory() {
    setSequencia((atual) => (atual.length >= MAX_STORIES ? atual : [...atual, ""]));
  }

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <label className="rotulo">Legenda do post</label>
          <span className="text-xs tabular-nums text-tinta-3">{legenda.length} caracteres</span>
        </div>
        <Textarea
          name="content"
          value={legenda}
          onChange={(e) => setLegenda(e.target.value)}
          rows={12}
          className="text-sm leading-relaxed"
        />
      </div>

      {pieceFormat === "CARD" && (
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <label className="rotulo">Texto da arte</label>
            <Contador atual={textoImagem.length} limite={CARD_IMAGE_TEXT_LIMIT} />
          </div>
          <Textarea
            name="imageText"
            value={textoImagem}
            onChange={(e) => setTextoImagem(e.target.value)}
            rows={3}
            placeholder="Texto que vai dentro da imagem"
            className="text-sm"
          />
        </div>
      )}

      {pieceFormat === "CARROSSEL" && (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <label className="rotulo">Cards do carrossel ({cardsComPapel.length})</label>
            {cardsComPapel.length < MAX_SLIDES && (
              <button
                type="button"
                onClick={adicionarCard}
                className="inline-flex items-center gap-1 text-xs font-medium text-mata hover:underline"
              >
                <Plus className="size-3.5" strokeWidth={1.5} />
                Adicionar card
              </button>
            )}
          </div>

          {cardsComPapel.map((card, i) => (
            <div key={i} className="rounded-controle border border-linha bg-carta p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-semibold text-mata">
                  {i + 1}. {SLIDE_ROLE_LABEL[card.role]}
                </span>
                <div className="flex items-center gap-3">
                  <Contador atual={card.text.length} limite={slideLimit(card.role)} />
                  {cardsComPapel.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removerCard(i)}
                      aria-label={`Remover card ${i + 1}`}
                      className="text-tinta-3 hover:text-risco"
                    >
                      <X className="size-3.5" strokeWidth={1.5} />
                    </button>
                  )}
                </div>
              </div>
              <Textarea
                name="slideText"
                value={card.text}
                onChange={(e) => alterarCard(i, e.target.value)}
                rows={2}
                className="mt-2 text-sm"
              />
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3 rounded-controle border border-linha-2 bg-bruma/10 p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <label className="rotulo inline-flex items-center gap-1.5">
            <Smartphone className="size-3.5" strokeWidth={1.5} />
            Stories ({sequencia.length})
          </label>
          <div className="flex items-center gap-3">
            {sequencia.length < MAX_STORIES && (
              <button
                type="button"
                onClick={adicionarStory}
                className="inline-flex items-center gap-1 text-xs font-medium text-mata hover:underline"
              >
                <Plus className="size-3.5" strokeWidth={1.5} />
                Adicionar story
              </button>
            )}
            <button
              type="button"
              onClick={refazerStories}
              className="inline-flex items-center gap-1 text-xs font-medium text-tinta-3 hover:text-tinta"
            >
              <RefreshCw className="size-3.5" strokeWidth={1.5} />
              Refazer a partir da arte
            </button>
          </div>
        </div>

        <p className="text-xs text-tinta-3">
          É o mesmo texto da arte — um story por card. Apague os que não quiser para condensar a
          sequência; nada aqui chama a IA.
        </p>

        {sequencia.length === 0 ? (
          <p className="text-xs text-tinta-3">
            Sem stories. Use &quot;Refazer a partir da arte&quot; para criar a sequência.
          </p>
        ) : (
          sequencia.map((texto, i) => (
            <div key={i} className="rounded-controle border border-linha bg-carta p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-semibold text-mata">Story {i + 1}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs tabular-nums text-tinta-3">{texto.length} caracteres</span>
                  <button
                    type="button"
                    onClick={() => removerStory(i)}
                    aria-label={`Remover story ${i + 1}`}
                    className="text-tinta-3 hover:text-risco"
                  >
                    <X className="size-3.5" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
              <Textarea
                name="storyText"
                value={texto}
                onChange={(e) => alterarStory(i, e.target.value)}
                rows={2}
                className="mt-2 text-sm"
              />
            </div>
          ))
        )}
      </div>

      <Button type="submit" variant="outline">
        <PenLine className="mr-1.5 size-4" strokeWidth={1.5} />
        Salvar edição
      </Button>
    </form>
  );
}
