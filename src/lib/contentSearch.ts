import { db } from "@/lib/db";
import { embedText } from "@/lib/rag/embed";
import type { SessionUser } from "@/lib/auth/session";

export type ResultadoBusca = {
  themeId: string;
  title: string;
  justification: string;
  period: string;
  clientId: string;
  clientName: string;
  textPreview: string | null;
  textStatus: string | null;
  semelhanca: number;
};

// Abaixo disso os resultados param de ter relação com o que foi buscado.
const RELEVANCIA_MINIMA = 0.35;

function paraVetor(embedding: number[]): string {
  const valores = embedding.map((n) => {
    if (!Number.isFinite(n)) throw new Error("Embedding inválido.");
    return n;
  });
  return `[${valores.join(",")}]`;
}

// Busca semântica sobre os temas já produzidos: encontra pelo sentido, não pela
// palavra exata — "financiamento" acha um tema sobre "condições de pagamento".
//
// O filtro de acesso vai no SQL e não depois, para não vazar contagem nem
// posição de cliente que o redator não pode ver.
export async function buscarConteudo(user: SessionUser, consulta: string, limite = 20): Promise<ResultadoBusca[]> {
  const termo = consulta.trim();
  if (termo.length < 3) return [];

  const vetor = paraVetor(await embedText(termo));

  const veTudo = user.role === "ADMIN" || user.role === "INTERN";
  const filtroAcesso = veTudo
    ? ""
    : `AND (
         c."squadId" = $4
         OR EXISTS (SELECT 1 FROM client_access ca WHERE ca."clientId" = c.id AND ca."userId" = $3)
       )`;

  const parametros: unknown[] = [limite, RELEVANCIA_MINIMA];
  if (!veTudo) parametros.push(user.id, user.squadId ?? "");

  return db.$queryRawUnsafe<ResultadoBusca[]>(
    `SELECT
       t.id AS "themeId",
       t.title,
       t.justification,
       b.period,
       c.id AS "clientId",
       c.name AS "clientName",
       LEFT(txt.content, 200) AS "textPreview",
       txt.status::text AS "textStatus",
       1 - (t.embedding <=> '${vetor}'::vector) AS "semelhanca"
     FROM content_themes t
     JOIN briefings b ON b.id = t."briefingId"
     JOIN clients c ON c.id = t."clientId"
     LEFT JOIN LATERAL (
       SELECT g.content, g.status
       FROM generated_texts g
       WHERE g."themeId" = t.id
       ORDER BY g.version DESC
       LIMIT 1
     ) txt ON true
     WHERE t.embedding IS NOT NULL
       AND 1 - (t.embedding <=> '${vetor}'::vector) >= $2
       ${filtroAcesso}
     ORDER BY t.embedding <=> '${vetor}'::vector
     LIMIT $1`,
    ...parametros
  );
}
