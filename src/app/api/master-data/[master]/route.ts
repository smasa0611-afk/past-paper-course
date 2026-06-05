import { NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/admin";
import { exportMasterCsvAsync, getMasterDefinition, masterSummaryAsync, queryMasterRecordsAsync } from "@/lib/master-data";

export async function GET(
  request: Request,
  props: { params: Promise<{ master: string }> },
) {
  const params = await props.params;

  try {
    const session = await requireSystemAdmin();
    if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status });

    const definition = getMasterDefinition(params.master);
    if (!definition) return NextResponse.json({ error: "Unknown master" }, { status: 404 });

    const url = new URL(request.url);
    if (url.searchParams.get("format") === "csv") {
      const csv = await exportMasterCsvAsync(definition);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${definition.fileName}"`,
        },
      });
    }

    const q = url.searchParams.get("q") ?? "";
    const page = Number(url.searchParams.get("page") ?? "1");
    const pageSize = Number(url.searchParams.get("pageSize") ?? "50");
    return NextResponse.json({
      summary: await masterSummaryAsync(definition),
      ...(await queryMasterRecordsAsync(definition, q, page, pageSize)),
    });
  } catch (error) {
    console.error("Error reading master records:", error);
    return NextResponse.json({ error: "マスターデータの読み込みに失敗しました。" }, { status: 500 });
  }
}
