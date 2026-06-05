import { NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/admin";
import {
  commitImportAsync,
  createPendingImportAsync,
  getMasterDefinition,
  masterImportStorageReady,
  parseMasterCsvWithEncodingIssues,
  readMasterRecordsAsync,
  readPendingImportAsync,
  validateImport,
} from "@/lib/master-data";

export async function POST(
  request: Request,
  props: { params: Promise<{ master: string }> },
) {
  const params = await props.params;

  try {
    const session = await requireSystemAdmin();
    if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status });
    if (!masterImportStorageReady()) {
      return NextResponse.json(
        { error: "マスターCSV取込用の保存先が未設定です。本番ではSupabase/PostgresのDATABASE_URLまたはPOSTGRES_URLを設定してから、もう一度取込前チェックを実行してください。" },
        { status: 503 },
      );
    }

    const definition = getMasterDefinition(params.master);
    if (!definition) return NextResponse.json({ error: "Unknown master" }, { status: 404 });

    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as { previewId?: string };
      if (!body.previewId) return NextResponse.json({ error: "previewId is required" }, { status: 400 });
      const pending = await readPendingImportAsync(body.previewId);
      if (!pending || pending.masterKey !== definition.key) {
        return NextResponse.json({ error: "確認済みインポートが見つかりません。" }, { status: 404 });
      }
      if (pending.summary.errorCount > 0) {
        return NextResponse.json({ error: "エラーがあるため取込できません。", issues: pending.issues }, { status: 400 });
      }
      const result = await commitImportAsync(pending, session.user.id);
      return NextResponse.json({ success: true, ...result });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "CSVファイルを選択してください。" }, { status: 400 });

    const parsed = parseMasterCsvWithEncodingIssues(Buffer.from(await file.arrayBuffer()));
    const existingRecords = await readMasterRecordsAsync(definition.key);
    const validation = validateImport(definition, parsed.rows, existingRecords, undefined, parsed.issues);
    const pending = await createPendingImportAsync(
      definition.key,
      file.name || definition.fileName,
      session.user.id,
      validation.records,
      validation.summary,
      validation.issues,
      validation.skippedKeys,
    );

    return NextResponse.json({
      previewId: pending.id,
      summary: pending.summary,
      issues: pending.issues.slice(0, 200),
      previewRows: pending.records.slice(0, 5),
      canCommit: pending.summary.errorCount === 0,
    });
  } catch (error) {
    console.error("Error importing master CSV:", error);
    return NextResponse.json({ error: "CSV取込の検証に失敗しました。" }, { status: 500 });
  }
}
