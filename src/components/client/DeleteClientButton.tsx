"use client";

import { useRef } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteClientAction } from "@/app/(dashboard)/clients/actions";

export function DeleteClientButton({ clientId, clientName }: { clientId: string; clientName: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const action = deleteClientAction.bind(null, clientId);

  return (
    <form
      ref={formRef}
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`Excluir "${clientName}" e todos os dados ligados a ele? Essa ação não pode ser desfeita.`)) {
          e.preventDefault();
        }
      }}
    >
      <Button type="submit" variant="destructive" size="sm">
        <Trash2 className="mr-1.5 size-4" strokeWidth={1.5} />
        Excluir cliente
      </Button>
    </form>
  );
}
