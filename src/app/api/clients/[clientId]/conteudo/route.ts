import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireClientAccess } from "@/lib/auth/guards";
import { currentPeriod } from "@/lib/periodo";
import { buildContentMarkdown, contentFileName } from "@/lib/contentExport";
import type { Keyword } from "@/lib/keywords/provider";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  await requireClientAccess(clientId);

  const period = request.nextUrl.searchParams.get("period") ?? currentPeriod();

  const client = await db.client.findUnique({ where: { id: clientId } });
  if (!client) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });

  const briefing = await db.briefing.findUnique({ where: { clientId_period: { clientId, period } } });

  const [themes, keywordReport] = await Promise.all([
    briefing
      ? db.contentTheme.findMany({
          where: { briefingId: briefing.id, status: "SELECTED" },
          orderBy: { createdAt: "asc" },
          include: { texts: { orderBy: { version: "desc" }, take: 1 } },
        })
      : Promise.resolve([]),
    db.keywordReport.findFirst({ where: { clientId, period }, orderBy: { createdAt: "desc" } }),
  ]);

  const markdown = buildContentMarkdown({
    clientName: client.name,
    niche: client.niche,
    period,
    briefing: briefing ? { goals: briefing.goals, keyDates: briefing.keyDates } : null,
    keywords: (keywordReport?.keywords as Keyword[] | null) ?? [],
    themes: themes.map((t) => ({ title: t.title, text: t.texts[0] ?? null })),
  });

  return new NextResponse(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${contentFileName(client.name, period)}"`,
    },
  });
}
