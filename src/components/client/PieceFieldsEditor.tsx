"use client";

import { useState } from "react";
import { PenLine, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  CARD_IMAGE_TEXT_LIMIT,
  MAX_SLIDES,
  SLIDE_ROLE_LABEL,
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
}: {
  action: (formData: FormData) => void;
  pieceFormat: PieceFormat | null;
  caption: string;
  imageText: string | null;
  slides: Slide[];
}) {
  const [legenda, setLegenda] = useState(caption);
  const [textoImagem, setTextoImagem] = useState(imageText ?? "");
  const [cards, setCards] = useState<Slide[]>(slides);

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

      <Button type="submit" variant="outline">
        <PenLine className="mr-1.5 size-4" strokeWidth={1.5} />
        Salvar edição
      </Button>
    </form>
  );
}
