// Formato editorial da peça e limites de caracteres de cada campo de arte.
// Fonte única desses números: a IA recebe daqui, a tela valida daqui.

export type PieceFormat = "CARD" | "CARROSSEL";
export type SlideRole = "CAPA" | "INTERNO" | "CTA";

export type Slide = { role: SlideRole; text: string };

export const CARD_IMAGE_TEXT_LIMIT = 150;

export const SLIDE_LIMITS: Record<SlideRole, number> = {
  CAPA: 150,
  INTERNO: 250,
  CTA: 100,
};

export const SLIDE_ROLE_LABEL: Record<SlideRole, string> = {
  CAPA: "Capa",
  INTERNO: "Card",
  CTA: "CTA",
};

export const PIECE_FORMAT_LABEL: Record<PieceFormat, string> = {
  CARD: "Card (imagem única)",
  CARROSSEL: "Carrossel (a IA decide quantos, até 10)",
};

export const MAX_SLIDES = 10;

export function slideLimit(role: SlideRole): number {
  return SLIDE_LIMITS[role];
}

// Lê o campo Json do banco com segurança: descarta qualquer coisa fora do formato esperado.
export function parseSlides(value: unknown): Slide[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is { role: string; text: string } =>
      !!item && typeof item === "object" && typeof (item as { text?: unknown }).text === "string"
    )
    .map((item) => ({
      role: isSlideRole(item.role) ? item.role : "INTERNO",
      text: item.text,
    }))
    .slice(0, MAX_SLIDES);
}

function isSlideRole(value: unknown): value is SlideRole {
  return value === "CAPA" || value === "INTERNO" || value === "CTA";
}

// Reconstrói os papéis pela posição: o primeiro é sempre capa, o último sempre CTA.
// Usado depois de o redator adicionar ou remover cards na revisão.
export function normalizeSlideRoles(slides: Slide[]): Slide[] {
  return slides.map((slide, i) => {
    if (i === 0) return { ...slide, role: "CAPA" as const };
    if (i === slides.length - 1 && slides.length > 1) return { ...slide, role: "CTA" as const };
    return { ...slide, role: "INTERNO" as const };
  });
}

export function isOverLimit(slide: Slide): boolean {
  return slide.text.length > slideLimit(slide.role);
}
