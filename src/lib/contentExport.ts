import { periodLabel } from "@/lib/periodo";
import {
  PIECE_FORMAT_LABEL,
  SLIDE_ROLE_LABEL,
  parseSlides,
  parseStories,
  type PieceFormat,
} from "@/lib/contentPiece";
import type { Keyword } from "@/lib/keywords/provider";

export type ExportTheme = {
  title: string;
  text: {
    content: string;
    status: string;
    version: number;
    pieceFormat: string | null;
    imageText: string | null;
    slides: unknown;
    stories: unknown;
  } | null;
};

export type ContentExport = {
  clientName: string;
  niche: string;
  period: string;
  briefing: { goals: string; keyDates: string | null } | null;
  keywords: Keyword[];
  themes: ExportTheme[];
};

export function contentFileName(clientName: string, period: string): string {
  const slug = clientName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug}-${period}.md`;
}

// Monta o entregável do mês em Markdown: briefing, palavras-chave e cada post com
// legenda, texto de arte e cards.
export function buildContentMarkdown(data: ContentExport): string {
  const linhas: string[] = [];
  const add = (...l: string[]) => linhas.push(...l);

  add(`# ${data.clientName} — conteúdo de ${periodLabel(data.period)}`, "");
  add(`Nicho: ${data.niche}`, "");

  if (data.briefing) {
    add("## Briefing", "", data.briefing.goals, "");
    if (data.briefing.keyDates) add("### Datas comemorativas", "", data.briefing.keyDates, "");
  }

  if (data.keywords.length > 0) {
    add("## Palavras-chave do período", "");
    for (const k of data.keywords) add(`- ${k.term}${k.volume > 0 ? ` — volume ${k.volume}` : ""}`);
    add("");
  }

  add(`## Posts (${data.themes.length})`, "");
  if (data.themes.length === 0) add("_Nenhum tema selecionado para este período._", "");

  data.themes.forEach((theme, i) => {
    add(`### ${i + 1}. ${theme.title}`, "");

    if (!theme.text) {
      add("> Texto ainda não gerado.", "");
      return;
    }

    const formato = theme.text.pieceFormat
      ? PIECE_FORMAT_LABEL[theme.text.pieceFormat as PieceFormat]
      : "não definido";

    // O status vai explícito: sem isso um rascunho sai daqui parecendo conteúdo
    // final e ninguém percebe que faltou revisão.
    add(
      `**Formato:** ${formato}  `,
      `**Status:** ${theme.text.status === "APPROVED" ? "aprovado" : "rascunho, ainda não aprovado"}  `,
      `**Versão:** ${theme.text.version}`,
      ""
    );

    add("**Legenda**", "", theme.text.content, "");

    if (theme.text.imageText) add("**Texto da arte**", "", theme.text.imageText, "");

    const slides = parseSlides(theme.text.slides);
    if (slides.length > 0) {
      add("**Cards**", "");
      slides.forEach((slide, j) => add(`${j + 1}. **${SLIDE_ROLE_LABEL[slide.role]}** — ${slide.text}`));
      add("");
    }

    // Os stories entram no pacote de entrega: são material do design como qualquer card.
    const stories = parseStories(theme.text.stories);
    if (stories.length > 0) {
      add(`**Stories (${stories.length})**`, "");
      stories.forEach((texto, j) => add(`${j + 1}. ${texto}`));
      add("");
    }
  });

  const pendentes = data.themes.filter((t) => t.text?.status !== "APPROVED").length;
  if (pendentes > 0) {
    add("---", "", `> Atenção: ${pendentes} de ${data.themes.length} post(s) ainda não foram aprovados.`, "");
  }

  return linhas.join("\n");
}
