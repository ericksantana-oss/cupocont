import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verificarConta } from "@/lib/meta/tokenHealth";
import { requireClientAccess } from "@/lib/auth/guards";
import {
  exchangeCodeForUserToken,
  exchangeForLongLivedToken,
  findInstagramAccounts,
  getInstagramUsername,
} from "@/lib/meta/graph";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const clientId = request.nextUrl.searchParams.get("state");
  const origin = request.nextUrl.origin;

  if (!clientId) return NextResponse.json({ error: "state (clientId) ausente." }, { status: 400 });

  const redirectTo = (status: "connected" | "choose" | "error", message?: string) => {
    const url = new URL(`/clients/${clientId}/contexto`, origin);
    url.searchParams.set("instagram", status);
    if (message) url.searchParams.set("instagram_error", message);
    return NextResponse.redirect(url);
  };

  await requireClientAccess(clientId);

  if (!code) return redirectTo("error", "Autorização cancelada.");

  try {
    const shortLivedToken = await exchangeCodeForUserToken(code);
    const longLivedToken = await exchangeForLongLivedToken(shortLivedToken);
    const pages = await findInstagramAccounts(longLivedToken);

    if (pages.length === 0) {
      return redirectTo(
        "error",
        "Nenhuma conta comercial do Instagram foi encontrada nas páginas do Facebook autorizadas. Confirme que a conta do Instagram do cliente está vinculada a uma Página do Facebook e é uma conta comercial/criador de conteúdo."
      );
    }

    const candidates = await Promise.all(
      pages.map(async (page) => ({
        pageId: page.pageId,
        pageName: page.pageName,
        igUserId: page.igUserId,
        igUsername: await getInstagramUsername(page.igUserId, page.pageAccessToken),
        pageAccessToken: page.pageAccessToken,
      }))
    );

    // Só uma conta encontrada: conecta direto, sem precisar perguntar.
    if (candidates.length === 1) {
      const only = candidates[0];
      await db.instagramAccount.upsert({
        where: { clientId },
        create: {
          clientId,
          igUserId: only.igUserId,
          igUsername: only.igUsername,
          pageId: only.pageId,
          pageName: only.pageName,
          pageAccessToken: only.pageAccessToken,
        },
        update: {
          igUserId: only.igUserId,
          igUsername: only.igUsername,
          pageId: only.pageId,
          pageName: only.pageName,
          pageAccessToken: only.pageAccessToken,
          // Reconexao zera o estado de saude antigo; verificarConta() preenche em seguida.
          tokenValid: true,
          tokenCheckedAt: null,
          tokenExpiresAt: null,
          tokenDataAccessExpiresAt: null,
          tokenError: null,
        },
      });
      await verificarConta(clientId);
      return redirectTo("connected");
    }

    // Mais de uma conta: precisa que o usuário escolha qual pertence a este cliente.
    await db.instagramPendingSelection.deleteMany({ where: { clientId } });
    await db.instagramPendingSelection.create({ data: { clientId, candidates } });

    return redirectTo("choose");
  } catch (err) {
    return redirectTo("error", err instanceof Error ? err.message : "Erro desconhecido.");
  }
}
