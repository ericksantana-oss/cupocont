import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireClientAccess } from "@/lib/auth/guards";
import {
  exchangeCodeForUserToken,
  exchangeForLongLivedToken,
  findInstagramAccount,
  getInstagramUsername,
} from "@/lib/meta/graph";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const clientId = request.nextUrl.searchParams.get("state");
  const origin = request.nextUrl.origin;

  if (!clientId) return NextResponse.json({ error: "state (clientId) ausente." }, { status: 400 });

  const redirectTo = (status: "connected" | "error", message?: string) => {
    const url = new URL(`/clients/${clientId}/conteudo`, origin);
    url.searchParams.set("tab", "contexto");
    url.searchParams.set("instagram", status);
    if (message) url.searchParams.set("instagram_error", message);
    return NextResponse.redirect(url);
  };

  await requireClientAccess(clientId);

  if (!code) return redirectTo("error", "Autorização cancelada.");

  try {
    const shortLivedToken = await exchangeCodeForUserToken(code);
    const longLivedToken = await exchangeForLongLivedToken(shortLivedToken);
    const account = await findInstagramAccount(longLivedToken);

    if (!account) {
      return redirectTo(
        "error",
        "Nenhuma conta comercial do Instagram foi encontrada nas páginas do Facebook autorizadas."
      );
    }

    const igUsername = await getInstagramUsername(account.igUserId, account.pageAccessToken);

    await db.instagramAccount.upsert({
      where: { clientId },
      create: {
        clientId,
        igUserId: account.igUserId,
        igUsername,
        pageAccessToken: account.pageAccessToken,
      },
      update: {
        igUserId: account.igUserId,
        igUsername,
        pageAccessToken: account.pageAccessToken,
      },
    });

    return redirectTo("connected");
  } catch (err) {
    return redirectTo("error", err instanceof Error ? err.message : "Erro desconhecido.");
  }
}
