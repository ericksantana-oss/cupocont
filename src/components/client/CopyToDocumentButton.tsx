"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopyToDocumentButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check className="mr-1.5 size-4" strokeWidth={1.5} /> : <Copy className="mr-1.5 size-4" strokeWidth={1.5} />}
      {copied ? "Copiado!" : "Copiar para documento"}
    </Button>
  );
}
