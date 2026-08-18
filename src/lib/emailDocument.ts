import type { MarketingEmail } from "@prisma/client";

// Monta o texto no padrão de produção da Cupola, pronto para colar em Google Docs/Word.
export function formatEmailForDocument(email: MarketingEmail): string {
  const parts: string[] = [];

  parts.push("INFORMAÇÕES DE DISPARO");
  parts.push(`Base que será impactada: ${email.audience ?? "—"}`);
  parts.push(`E-mail do remetente: ${email.senderEmail ?? "—"}`);
  parts.push(`Remetente: ${email.senderName ?? "—"}`);
  parts.push("");

  parts.push("ASSUNTOS");
  parts.push(`Assunto A: ${email.subjectA ?? "—"}`);
  parts.push(`Assunto B: ${email.subjectB ?? "—"}`);
  parts.push("");

  parts.push("PREHEADER");
  parts.push(email.preheader ?? "—");
  parts.push("");

  parts.push("DRIVE COM IMAGENS");
  parts.push(email.imagesFolderUrl ?? "—");
  parts.push("");

  if (email.hasCard && email.cardText) {
    parts.push("[CARD]");
    parts.push("Texto que irá compor o card:");
    parts.push(email.cardText);
    parts.push("");
  }

  parts.push(email.body ?? "");
  parts.push("");

  parts.push("[BOTÃO CTA]");
  parts.push(`Código da cor indicada para o botão: ${email.ctaColor ?? "—"}`);
  parts.push(`Texto que irá no botão de CTA: ${email.ctaText ?? "—"}`);
  parts.push("");

  parts.push("[DESPEDIDA]");
  parts.push(email.farewell ?? "—");
  if (email.senderName) parts.push(email.senderName);

  return parts.join("\n");
}
