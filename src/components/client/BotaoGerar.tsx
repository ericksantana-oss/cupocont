"use client";

import { useFormStatus } from "react-dom";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

// Botão de submit para qualquer ação que chama a IA. Mostra que está trabalhando,
// se desabilita e evita o clique duplo — que dispararia duas gerações.
// useFormStatus só funciona em componente filho do <form>, nunca no próprio form.
export function BotaoGerar({
  label,
  labelPendente = "A IA está escrevendo...",
  dica,
  size,
  variant,
}: {
  label: string;
  labelPendente?: string;
  /** Texto ao lado do botão enquanto gera. Omitido nos botões pequenos, onde poluiria. */
  dica?: string;
  size?: "sm" | "default";
  variant?: "default" | "outline" | "secondary" | "ghost";
}) {
  const { pending } = useFormStatus();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="submit" disabled={pending} size={size} variant={variant}>
        {pending ? (
          <>
            <Loader2 className="mr-1.5 size-4 animate-spin" strokeWidth={1.5} />
            {labelPendente}
          </>
        ) : (
          <>
            <Sparkles className="mr-1.5 size-4" strokeWidth={1.5} />
            {label}
          </>
        )}
      </Button>

      {pending && dica && (
        <span className="flex items-center gap-1.5 text-xs text-tinta-3" role="status" aria-live="polite">
          <span className="flex gap-1" aria-hidden="true">
            <span className="size-1.5 animate-pulse rounded-full bg-mata [animation-delay:0ms]" />
            <span className="size-1.5 animate-pulse rounded-full bg-mata [animation-delay:200ms]" />
            <span className="size-1.5 animate-pulse rounded-full bg-mata [animation-delay:400ms]" />
          </span>
          {dica}
        </span>
      )}
    </div>
  );
}
