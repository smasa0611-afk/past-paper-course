import crypto from "crypto";
import { NextResponse } from "next/server";
import { requireSystemAdmin } from "@/lib/admin";
import {
  buildImportDiffRowsAsync,
  bulkImportOrder,
  commitImportAsync,
  createPendingImportWithBatchAsync,
  getMasterDefinition,
  masterImportStorageReady,
  masterDefinitions,
  masterKeyFromFileName,
  mergeImportedRecords,
  parseMasterCsvWithEncodingIssues,
  readMasterRecords,
  readMasterRecordsAsync,
  readPendingImportAsync,
  type MasterKey,
  validateImport,
} from "@/lib/master-data";

export async function POST(request: Request) {
  try {
    const session = await requireSystemAdmin();
    if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status });

    const contentType = request.headers.get("content-type") ?? "";
    const storageReady = masterImportStorageReady();
    if (contentType.includes("application/json")) {
      if (!storageReady) {
        return NextResponse.json(
          { error: "マスターCSV取込用の保存先が未設定です。本番ではSupabase/PostgresのDATABASE_URLまたはPOSTGRES_URLを設定してから、取込確定してください。" },
          { status: 503 },
        );
      }
      const body = (await request.json()) as { previewIds?: string[] };
      const previewIds = body.previewIds ?? [];
      if (previewIds.length === 0) return NextResponse.json({ error: "確定対象が選択されていません。" }, { status: 400 });

      const pendingImports = (await Promise.all(previewIds.map((id) => readPendingImportAsync(id)))).filter(Boolean);
      if (pendingImports.length !== previewIds.length) return NextResponse.json({ error: "取込前チェック済みデータが見つかりません。" }, { status: 404 });
      const errored = pendingImports.find((pending) => pending!.summary.errorCount > 0);
      if (errored) return NextResponse.json({ error: "エラーがあるため取込確定できません。" }, { status: 400 });

      const ordered = [...pendingImports].sort((a, b) => bulkImportOrder.indexOf(a!.masterKey) - bulkImportOrder.indexOf(b!.masterKey));
      const results = await Promise.all(ordered.map((pending) => commitImportAsync(pending!, session.user.id)));
      return NextResponse.json({
        success: true,
        results: results.map((result) => result.log),
        totalCount: results.reduce((sum, result) => sum + result.totalCount, 0),
      });
    }

    const form = await request.formData();
    const files = form.getAll("files").filter((file): file is File => file instanceof File);
    if (files.length === 0) return NextResponse.json({ error: "CSVファイルを選択してください。" }, { status: 400 });

    const filesByMaster = new Map<MasterKey, File>();
    const unknownFiles: string[] = [];
    files.forEach((file) => {
      const masterKey = masterKeyFromFileName(file.name);
      if (!masterKey) {
        unknownFiles.push(file.name);
        return;
      }
      filesByMaster.set(masterKey, file);
    });

    const batchId = crypto.randomUUID();
    const sources = new Map<MasterKey, ReturnType<typeof readMasterRecords>>();
    const sourceRecords = await Promise.all(masterDefinitions.map(async (definition) => [definition.key, await readMasterRecordsAsync(definition.key)] as const));
    sourceRecords.forEach(([key, records]) => sources.set(key, records));

    const summaries = [];
    const diffRows = [];
    for (const masterKey of bulkImportOrder) {
      const file = filesByMaster.get(masterKey);
      if (!file) continue;
      const definition = getMasterDefinition(masterKey);
      if (!definition) continue;

      const parsed = parseMasterCsvWithEncodingIssues(Buffer.from(await file.arrayBuffer()));
      const existingRecords = await readMasterRecordsAsync(definition.key);
      const validation = validateImport(definition, parsed.rows, existingRecords, sources, parsed.issues);
      const previewId = storageReady
        ? (
          await createPendingImportWithBatchAsync(
            definition.key,
            file.name || definition.fileName,
            session.user.id,
            validation.records,
            validation.summary,
            validation.issues,
            batchId,
            validation.skippedKeys,
          )
        ).id
        : `storage-disabled:${batchId}:${definition.key}`;
      const mergedRecords = mergeImportedRecords(definition, existingRecords, validation.records);
      sources.set(definition.key, mergedRecords);
      const rows = await buildImportDiffRowsAsync(definition, validation.records, validation.issues);
      diffRows.push(...rows);
      summaries.push({
        previewId,
        batchId,
        masterKey: definition.key,
        masterLabel: definition.label,
        fileName: file.name || definition.fileName,
        expectedFileName: definition.fileName,
        canCommit: storageReady && validation.summary.errorCount === 0,
        summary: validation.summary,
      });
    }

    return NextResponse.json({
      batchId,
      unknownFiles,
      missingFiles: bulkImportOrder
        .filter((masterKey) => !filesByMaster.has(masterKey))
        .map((masterKey) => getMasterDefinition(masterKey)?.fileName)
        .filter(Boolean),
      summaries,
      diffRows: diffRows.slice(0, 1500),
      canCommit: storageReady && summaries.length > 0 && summaries.every((summary) => summary.canCommit),
    });
  } catch (error) {
    console.error("Error bulk importing master CSV:", error);
    return NextResponse.json({ error: "CSV一括取込の処理に失敗しました。" }, { status: 500 });
  }
}
