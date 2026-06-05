import { NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/admin";
import { readImportLogsAsync } from "@/lib/master-data";

export async function GET() {
  try {
    const session = await requireSystemAdmin();
    if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status });

    return NextResponse.json({ logs: (await readImportLogsAsync()).slice(0, 200) });
  } catch (error) {
    console.error("Error reading master import logs:", error);
    return NextResponse.json({ error: "取込ログの読み込みに失敗しました。" }, { status: 500 });
  }
}
