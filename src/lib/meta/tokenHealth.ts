import { db } from "@/lib/db";
import { graphGet } from "@/lib/meta/graph";

// Saúde da conexão com o Meta.
//
// O que se verifica aqui NÃO é o vencimento do token — o token de Página, obtido a
// partir de um token de usuário de longa duração, não expira: o debug_token devolve
// expires_at = 0. O que vence é o ACESSO AOS DADOS (data_access_expires_at), 90 dias
// depois da autorização, e é isso que precisa de aviso.
//
// Por que vale o trabalho: quando o acesso vence, nada quebra na tela. As consultas
// voltam vazias, o dashboard fica em branco e o cron para de congelar os meses. Mês
// não congelado não volta — o Meta descarta insights antigos. É a única perda
// irreversível do projeto, e hoje ela aconteceria sem ninguém perceber.

// Alerta com um mês de antecedência: o cron roda uma vez por dia, então 30 dias dão
// folga de sobra para alguém reconectar sem correria.
const DIAS_PARA_ALERTAR = 30;

const MS_POR_DIA = 86_400_000;

interface DebugTokenResponse {
  data?: {
    is_valid?: boolean;
    expires_at?: number;
    data_access_expires_at?: number;
    error?: { message?: string };
  };
}

function dataDeTimestamp(segundos: number | undefined): Date | null {
  // O Meta usa 0 para "não expira", não para 01/01/1970.
  if (!segundos) return null;
  return new Date(segundos * 1000);
}

export interface SaudeDoToken {
  valido: boolean;
  expiraEm: Date | null;
  acessoAosDadosExpiraEm: Date | null;
  erro: string | null;
}

// Pergunta ao Meta o estado de um token. Usa o token do APP (app_id|app_secret) para
// autenticar a consulta, e não o próprio token inspecionado: um token inválido não
// consegue nem perguntar sobre si mesmo.
export async function inspecionarToken(pageAccessToken: string): Promise<SaudeDoToken> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) throw new Error("META_APP_ID e META_APP_SECRET são necessários para verificar o token.");

  const resposta = await graphGet<DebugTokenResponse>("/debug_token", {
    input_token: pageAccessToken,
    access_token: `${appId}|${appSecret}`,
  });

  const dados = resposta.data ?? {};
  return {
    valido: dados.is_valid === true,
    expiraEm: dataDeTimestamp(dados.expires_at),
    acessoAosDadosExpiraEm: dataDeTimestamp(dados.data_access_expires_at),
    erro: dados.error?.message ?? null,
  };
}

export type NivelDeAlerta = "ok" | "alerta" | "critico";

export interface StatusDaConexao {
  nivel: NivelDeAlerta;
  diasRestantes: number | null;
  mensagem: string;
}

interface ContaVerificavel {
  tokenValid: boolean;
  tokenCheckedAt: Date | null;
  tokenExpiresAt: Date | null;
  tokenDataAccessExpiresAt: Date | null;
  tokenError: string | null;
}

function diasAte(data: Date, agora: Date): number {
  return Math.ceil((data.getTime() - agora.getTime()) / MS_POR_DIA);
}

// Traduz o que está gravado no banco para uma frase que diz o que fazer.
// Só é chamada com dado já verificado: enquanto o cron não rodou uma vez,
// tokenCheckedAt é nulo e o resultado é "ok" silencioso, sem alarme falso.
export function avaliarConexao(conta: ContaVerificavel, agora = new Date()): StatusDaConexao {
  if (!conta.tokenCheckedAt) {
    return { nivel: "ok", diasRestantes: null, mensagem: "Conexão ainda não verificada." };
  }

  if (!conta.tokenValid) {
    return {
      nivel: "critico",
      diasRestantes: null,
      mensagem: conta.tokenError
        ? `O Meta recusou a conexão: ${conta.tokenError} Reconecte a conta.`
        : "O Meta recusou a conexão. Reconecte a conta.",
    };
  }

  // O prazo mais curto entre os dois é o que manda. Na prática o token não expira e só
  // o acesso aos dados corre, mas se o Meta mudar isso o código não precisa mudar junto.
  const prazos = [conta.tokenExpiresAt, conta.tokenDataAccessExpiresAt].filter((d): d is Date => d !== null);
  if (prazos.length === 0) {
    return { nivel: "ok", diasRestantes: null, mensagem: "Conexão ativa, sem prazo de vencimento." };
  }

  const prazo = new Date(Math.min(...prazos.map((d) => d.getTime())));
  const dias = diasAte(prazo, agora);

  if (dias <= 0) {
    return {
      nivel: "critico",
      diasRestantes: dias,
      mensagem: "O acesso aos dados do Meta venceu. Reconecte a conta — sem isso o histórico do mês não é salvo.",
    };
  }

  if (dias <= DIAS_PARA_ALERTAR) {
    return {
      nivel: "alerta",
      diasRestantes: dias,
      mensagem: `O acesso aos dados do Meta vence em ${dias} dia(s). Reconecte a conta antes disso.`,
    };
  }

  return { nivel: "ok", diasRestantes: dias, mensagem: `Acesso aos dados válido por mais ${dias} dia(s).` };
}

// Consulta o Meta e grava o resultado. Devolve o status já avaliado, ou null quando
// não deu para perguntar — uma falha de rede não é o mesmo que token inválido, então
// nesse caso o estado anterior fica como está e se tenta de novo amanhã.
async function atualizarSaude(id: string, pageAccessToken: string): Promise<StatusDaConexao | null> {
  let saude: SaudeDoToken;
  try {
    saude = await inspecionarToken(pageAccessToken);
  } catch {
    return null;
  }

  const dados = {
    tokenValid: saude.valido,
    tokenCheckedAt: new Date(),
    tokenExpiresAt: saude.expiraEm,
    tokenDataAccessExpiresAt: saude.acessoAosDadosExpiraEm,
    tokenError: saude.erro,
  };

  await db.instagramAccount.update({ where: { id }, data: dados });
  return avaliarConexao(dados);
}

// Chamada logo depois de conectar, para o prazo aparecer na tela na hora em vez de
// só no dia seguinte, quando o cron rodar. Falha em silêncio de propósito: não faz
// sentido derrubar uma conexão que deu certo porque a verificação não respondeu.
export async function verificarConta(clientId: string): Promise<void> {
  const conta = await db.instagramAccount.findUnique({
    where: { clientId },
    select: { id: true, pageAccessToken: true },
  });
  if (!conta) return;
  await atualizarSaude(conta.id, conta.pageAccessToken).catch(() => null);
}

// Roda no cron diário. Uma conta que falha não impede as outras de serem verificadas.
export async function verificarTodasAsContas(): Promise<{ verificadas: number; comProblema: number }> {
  const contas = await db.instagramAccount.findMany({
    select: { id: true, pageAccessToken: true },
  });

  let verificadas = 0;
  let comProblema = 0;

  await Promise.allSettled(
    contas.map(async (conta) => {
      const status = await atualizarSaude(conta.id, conta.pageAccessToken);
      if (!status) return;
      verificadas += 1;
      if (status.nivel !== "ok") comProblema += 1;
    })
  );

  return { verificadas, comProblema };
}

export interface ConexaoComAviso {
  clientId: string;
  clientName: string;
  status: StatusDaConexao;
}

// Usado na tela inicial. Recebe os clientes que a pessoa pode ver, para não vazar
// a existência de cliente de outro squad num aviso global.
export async function listarConexoesComAviso(clientIds: string[]): Promise<ConexaoComAviso[]> {
  if (clientIds.length === 0) return [];

  const contas = await db.instagramAccount.findMany({
    where: { clientId: { in: clientIds } },
    select: {
      clientId: true,
      tokenValid: true,
      tokenCheckedAt: true,
      tokenExpiresAt: true,
      tokenDataAccessExpiresAt: true,
      tokenError: true,
      client: { select: { name: true } },
    },
  });

  return contas
    .map((conta) => ({
      clientId: conta.clientId,
      clientName: conta.client.name,
      status: avaliarConexao(conta),
    }))
    .filter((c) => c.status.nivel !== "ok")
    .sort((a, b) => (a.status.diasRestantes ?? -1) - (b.status.diasRestantes ?? -1));
}
