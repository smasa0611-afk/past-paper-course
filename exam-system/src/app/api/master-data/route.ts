import { NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/admin";
import { masterDefinitions, masterSummaryAsync, readImportLogsAsync } from "@/lib/master-data";

export async function GET() {
  try {
    const session = await requireSystemAdmin();
    if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status });

    const masters = await Promise.all(masterDefinitions.map(masterSummaryAsync));
    return NextResponse.json({
      masters,
      logs: (await readImportLogsAsync()).slice(0, 20),
    });
  } catch (error) {
    console.error("Error reading master summaries:", error);
    return NextResponse.json({ error: "マスター情報の読み込みに失敗しました。" }, { status: 500 });
  }
}
