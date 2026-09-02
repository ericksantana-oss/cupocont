import { db } from "@/lib/db";

// Feedback do cliente sobre os posts entregues, e como ele volta para os prompts.
//
// AVISO DE HONESTIDADE, para quem ler isto depois esperando outra coisa: não existe
// aprendizado de máquina aqui. Nada é treinado, o modelo não guarda memória entre
// chamadas. O que acontece é que o texto do feedback é lido do banco e colado no prompt
// a cada geração, pelo mesmo caminho das regras fixas. O ganho é real, mas o mecanismo é
// contexto, não treino — e isso importa porque define o limite: o que não couber no
// prompt não influencia nada.

// Limites de quanto feedback entra no prompt. Não são estéticos: prompt é espaço finito
// e caro, e feedback antigo de um cliente que já mudou de rumo atrapalha mais que ajuda.
const MAX_REPROVADOS = 10;
const MAX_APROVADOS_COM_COMENTARIO = 8;

// Feedback sem comentário de um post APROVADO não carrega informação além de "estava
// bom", então nem entra na lista — só na contagem. Reprovado sem comentário entra, porque
// "este tema o cliente recusou" já é sinal.

export interface PostComFeedback {
  themeId: string;
  themeTitle: string;
  // O número congelado ao finalizar a produção, e não a posição na lista: usar a posição
  // faria esta tela mostrar um número diferente do que está no calendário.
  postIndex: number | null;
  verdict: "APPROVED" | "REJECTED" | null;
  comment: string | null;
}

export interface ResumoDeFeedback {
  total: number;
  aprovados: number;
  reprovados: number;
  semFeedback: number;
}

export function resumirFeedback(posts: PostComFeedback[]): ResumoDeFeedback {
  return {
    total: posts.length,
    aprovados: posts.filter((p) => p.verdict === "APPROVED").length,
    reprovados: posts.filter((p) => p.verdict === "REJECTED").length,
    semFeedback: posts.filter((p) => p.verdict === null).length,
  };
}

// Bloco que vai para o prompt. Vazio quando não há feedback, para não colocar no contexto
// um cabeçalho sem conteúdo — mesma regra do formatClientRules.
export async function formatClientFeedback(clientId: string): Promise<string> {
  const registros = await db.clientFeedback.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    select: {
      verdict: true,
      comment: true,
      theme: { select: { title: true } },
      demand: { select: { period: true } },
    },
  });

  if (registros.length === 0) return "";

  const reprovados = registros.filter((r) => r.verdict === "REJECTED").slice(0, MAX_REPROVADOS);
  const aprovadosComentados = registros
    .filter((r) => r.verdict === "APPROVED" && r.comment?.trim())
    .slice(0, MAX_APROVADOS_COM_COMENTARIO);

  const totalAprovados = registros.filter((r) => r.verdict === "APPROVED").length;
  const totalReprovados = registros.filter((r) => r.verdict === "REJECTED").length;

  const linhas: string[] = [
    "## O que o cliente aprovou e reprovou nas entregas anteriores",
    "Este é o julgamento real do cliente sobre posts já entregues — não suposição sobre o",
    "nicho. Vale mais que qualquer inferência: use como a evidência mais forte que existe",
    "sobre o gosto dele.",
    "",
    `Histórico: ${totalAprovados} post(s) aprovado(s) e ${totalReprovados} reprovado(s).`,
  ];

  if (reprovados.length > 0) {
    linhas.push(
      "",
      "### Reprovados pelo cliente — não repetir o tema nem o ângulo",
      ...reprovados.map((r) => {
        const motivo = r.comment?.trim() ? r.comment.trim() : "sem motivo registrado";
        return `- [${r.demand.period}] "${r.theme.title}" — ${motivo}`;
      })
    );
  }

  if (aprovadosComentados.length > 0) {
    linhas.push(
      "",
      "### Aprovados, mas com observação — tratar como correção a aplicar",
      ...aprovadosComentados.map((r) => `- [${r.demand.period}] "${r.theme.title}" — ${r.comment!.trim()}`)
    );
  }

  return linhas.join("\n");
}

// Posts de um mês com o veredito do cliente ao lado, para a tela de feedback.
export async function listarPostsParaFeedback(clientId: string, period: string): Promise<PostComFeedback[]> {
  const briefing = await db.briefing.findUnique({
    where: { clientId_period: { clientId, period } },
    select: {
      themes: {
        where: { status: "SELECTED" },
        orderBy: [{ postIndex: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          postIndex: true,
          clientFeedback: { select: { verdict: true, comment: true } },
        },
      },
    },
  });

  return (briefing?.themes ?? []).map((tema) => ({
    themeId: tema.id,
    themeTitle: tema.title,
    postIndex: tema.postIndex,
    verdict: tema.clientFeedback?.verdict ?? null,
    comment: tema.clientFeedback?.comment ?? null,
  }));
}
