import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireClientAccess } from "@/lib/auth/guards";
import { defaultRange, loadDashboardReportData } from "@/lib/reportData";
import { DashboardReportDocument } from "@/lib/pdf/DashboardReportDocument";

export const maxDuration = 60;

export async function GET(request: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  await requireClientAccess(clientId);

  const defaults = defaultRange();
  const from = request.nextUrl.searchParams.get("from") ?? defaults.from;
  const to = request.nextUrl.searchParams.get("to") ?? defaults.to;

  const data = await loadDashboardReportData(clientId, from, to);
  if (!data) {
    return NextResponse.json({ error: "Conecte o Instagram do cliente antes de exportar o relatório." }, { status: 400 });
  }

  const buffer = await renderToBuffer(DashboardReportDocument({ data }));
  const fileName = `relatorio-${data.client.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${from}-a-${to}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
