"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

// Botão de submit para ação que não chama IA. Mesmo papel do BotaoGerar — mostrar que
// está trabalhando e evitar clique duplo — sem a linguagem de "a IA está escrevendo",
// que aqui seria mentira.
//
// Vem embrulhado no próprio <form> porque useFormStatus só lê o form de um componente
// filho, e essas ações aparecem soltas no meio de outros elementos.
export function BotaoDeAcao({
  acao,
  rotulo,
  carregando,
  disabled,
  variant = "default",
  size = "sm",
}: {
  acao: () => Promise<void>;
  rotulo: string;
  carregando: string;
  disabled?: boolean;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "sm" | "default";
}) {
  return (
    <form action={acao}>
      <Submit rotulo={rotulo} carregando={carregando} disabled={disabled} variant={variant} size={size} />
    </form>
  );
}

function Submit({
  rotulo,
  carregando,
  disabled,
  variant,
  size,
}: {
  rotulo: string;
  carregando: string;
  disabled?: boolean;
  variant: "default" | "outline" | "secondary" | "ghost";
  size: "sm" | "default";
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size={size} variant={variant} disabled={pending || disabled}>
      {pending ? (
        <>
          <Loader2 className="mr-1.5 size-4 animate-spin" strokeWidth={1.5} />
          {carregando}
        </>
      ) : (
        rotulo
      )}
    </Button>
  );
}
