import { NextRequest, NextResponse } from "next/server";
import { requireClientAccess } from "@/lib/auth/guards";
import { buildAuthorizeUrl } from "@/lib/meta/graph";

export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get("clientId");
  if (!clientId) return NextResponse.json({ error: "clientId é obrigatório." }, { status: 400 });

  await requireClientAccess(clientId);

  return NextResponse.redirect(buildAuthorizeUrl(clientId));
}
