import { NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/admin";
import { checkMasterImportStorage } from "@/lib/master-data";

export async function GET() {
  try {
    const session = await requireSystemAdmin();
    if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status });

    const storage = await checkMasterImportStorage();
    return NextResponse.json(storage, { status: storage.ready ? 200 : 503 });
  } catch (error) {
    console.error("Error checking master import storage:", error);
    return NextResponse.json({ ready: false, provider: "unknown", message: "保存先の確認に失敗しました。" }, { status: 500 });
  }
}
