import { db } from "@/lib/db";

// Regras fixas do cliente, escritas pelo redator a partir de uma correção que
// ele não quer repetir todo mês. Entram em todo prompt daquele cliente.
export async function listClientRules(clientId: string) {
  return db.clientRule.findMany({
    where: { clientId },
    orderBy: { createdAt: "asc" },
    include: { createdBy: { select: { name: true } } },
  });
}

// Bloco que vai para o prompt. Vazio quando não há regra, para não poluir o
// contexto com um cabeçalho sem conteúdo.
export async function formatClientRules(clientId: string): Promise<string> {
  const regras = await db.clientRule.findMany({
    where: { clientId },
    orderBy: { createdAt: "asc" },
    select: { rule: true },
  });

  if (regras.length === 0) return "";

  return [
    "## Regras fixas deste cliente",
    "Correções que a equipe já fez e não quer repetir. Valem sobre qualquer outra orientação,",
    "com exceção do que o briefing do mês pedir explicitamente em contrário.",
    ...regras.map((r) => `- ${r.rule}`),
  ].join("\n");
}
