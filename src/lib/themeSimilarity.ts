import { db } from "@/lib/db";
import { embedTexts } from "@/lib/rag/embed";

// Acima disso os temas dizem essencialmente a mesma coisa. Calibrado para o
// all-MiniLM-L6-v2: abaixo de 0,80 aparecem pares que só compartilham o assunto
// geral ("bairro", "arquitetura"), o que geraria aviso em quase todo tema.
const LIMITE_SEMELHANCA = 0.8;

export type TemaRepetido = {
  themeId: string;
  tituloAnterior: string;
  periodoAnterior: string;
  semelhanca: number;
};

function paraVetor(embedding: number[]): string {
  const valores = embedding.map((n) => {
    if (!Number.isFinite(n)) throw new Error("Embedding inválido.");
    return n;
  });
  return `[${valores.join(",")}]`;
}

// Texto que representa o tema. Título e justificativa juntos: só o título é curto
// demais e dois temas diferentes com título parecido apareceriam como iguais.
function textoDoTema(tema: { title: string; justification: string }): string {
  return `${tema.title}\n${tema.justification}`;
}

// Gera e guarda o vetor dos temas recém-criados. Roda depois da criação porque o
// createMany do Prisma não escreve coluna de tipo vector.
export async function indexarTemas(temas: { id: string; title: string; justification: string }[]): Promise<void> {
  if (temas.length === 0) return;

  const vetores = await embedTexts(temas.map(textoDoTema));

  for (const [i, tema] of temas.entries()) {
    await db.$executeRawUnsafe(
      `UPDATE content_themes SET embedding = '${paraVetor(vetores[i])}'::vector WHERE id = $1`,
      tema.id
    );
  }
}

// Para cada tema do briefing, procura o tema MAIS parecido entre os que já viraram
// conteúdo em outros meses do mesmo cliente. Só compara com status SELECTED: repetir
// um tema que foi descartado não é problema, ele nunca foi publicado.
//
// Uma consulta só, com LATERAL — 20 temas separados seriam 20 idas ao banco.
export async function buscarTemasRepetidos(briefingId: string): Promise<TemaRepetido[]> {
  const linhas = await db.$queryRawUnsafe<
    { themeId: string; tituloAnterior: string; periodoAnterior: string; semelhanca: number }[]
  >(
    `SELECT
       atual.id AS "themeId",
       anterior.title AS "tituloAnterior",
       anterior.period AS "periodoAnterior",
       anterior.semelhanca AS "semelhanca"
     FROM content_themes atual
     CROSS JOIN LATERAL (
       SELECT p.title, b.period, 1 - (p.embedding <=> atual.embedding) AS semelhanca
       FROM content_themes p
       JOIN briefings b ON b.id = p."briefingId"
       WHERE p."clientId" = atual."clientId"
         AND p."briefingId" <> atual."briefingId"
         AND p.status = 'SELECTED'
         AND p.embedding IS NOT NULL
       ORDER BY p.embedding <=> atual.embedding
       LIMIT 1
     ) anterior
     WHERE atual."briefingId" = $1
       AND atual.embedding IS NOT NULL
       AND anterior.semelhanca >= $2`,
    briefingId,
    LIMITE_SEMELHANCA
  );

  return linhas;
}
