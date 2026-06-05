import crypto from "crypto";
import fs from "fs";
import path from "path";
import { neon } from "@neondatabase/serverless";
import { del, get, put } from "@vercel/blob";
import { parseCsv, type CsvRow } from "@/lib/csv";
import { readJsonFile, writeJsonFileAtomic } from "@/lib/json-file-store";

export type MasterKey =
  | "brands"
  | "universities"
  | "gradeMasters"
  | "headquarters"
  | "schools"
  | "employees"
  | "employeeHeadquarterPermissions"
  | "employeeSchoolPermissions"
  | "courseLineups"
  | "students"
  | "studentCourseEnrollments";

export type MasterRecord = Record<string, string>;

export type ImportIssue = {
  line: number;
  column?: string;
  message: string;
  level: "error" | "warning";
  record?: MasterRecord;
};

export type ImportSummary = {
  totalRows: number;
  addCount: number;
  updateCount: number;
  disabledCount: number;
  skipCount: number;
  errorCount: number;
  warningCount: number;
};

export type MasterImportLog = ImportSummary & {
  id: string;
  batchId?: string;
  masterKey: MasterKey;
  masterLabel: string;
  fileName: string;
  importedAt: string;
  importedBy: string;
  status: "validated" | "success" | "failed";
  issues: ImportIssue[];
};

export type PendingImport = {
  id: string;
  batchId?: string;
  masterKey: MasterKey;
  fileName: string;
  createdAt: string;
  createdBy: string;
  records: MasterRecord[];
  skippedKeys?: string[];
  summary: ImportSummary;
  issues: ImportIssue[];
};

export type ImportDiffRow = {
  masterKey: MasterKey;
  masterLabel: string;
  primaryKey: string;
  changeType: "追加" | "更新" | "無効化候補" | "スキップ" | "エラー";
  before: MasterRecord | null;
  after: MasterRecord | null;
  reason?: string;
};

export type MasterDefinition = {
  key: MasterKey;
  label: string;
  description: string;
  fileName: string;
  storageName: string;
  requiredHeaders: string[];
  primaryKey: string[];
  previewColumns: string[];
  searchableColumns: string[];
};

export const masterDefinitions: MasterDefinition[] = [
  {
    key: "brands",
    label: "ブランドマスター",
    description: "ブランド（塾名）のIDと名称を管理します。",
    fileName: "BRAND.csv",
    storageName: "brands",
    requiredHeaders: ["ID", "名称"],
    primaryKey: ["ID"],
    previewColumns: ["ID", "名称"],
    searchableColumns: ["ID", "名称"],
  },
  {
    key: "universities",
    label: "大学マスター",
    description: "志望校、大学・学部・学科表示、大学別講座との紐づけに使う大学コードデータです。",
    fileName: "DAIGAKU.csv",
    storageName: "universities",
    requiredHeaders: ["コード", "大学名", "学部名", "学科名"],
    primaryKey: ["コード"],
    previewColumns: ["コード", "大学名", "学部名", "学科名"],
    searchableColumns: ["コード", "大学名", "学部名", "学科名"],
  },
  {
    key: "gradeMasters",
    label: "学年マスター",
    description: "学校区分と学年区分から表示用の学年を決める対応表です。",
    fileName: "GAKUNEN.csv",
    storageName: "grade_masters",
    requiredHeaders: ["学校区分", "学年区分", "学年"],
    primaryKey: ["学校区分", "学年区分"],
    previewColumns: ["学校区分", "学年区分", "学年"],
    searchableColumns: ["学校区分", "学年区分", "学年"],
  },
  {
    key: "headquarters",
    label: "本部マスター",
    description: "本部コードと本部名称を管理します。",
    fileName: "HONBU.csv",
    storageName: "headquarters",
    requiredHeaders: ["本部コード", "本部名称", "ブランドＩＤ"],
    primaryKey: ["本部コード"],
    previewColumns: ["本部コード", "本部名称", "ブランドＩＤ"],
    searchableColumns: ["本部コード", "本部名称", "ブランドＩＤ"],
  },
  {
    key: "schools",
    label: "校舎マスター",
    description: "校舎コード、校舎名称、所属本部を管理します。",
    fileName: "KOUSHA.csv",
    storageName: "schools",
    requiredHeaders: ["校舎コード", "校舎名称", "本部コード", "ブランドＩＤ"],
    primaryKey: ["校舎コード"],
    previewColumns: ["校舎コード", "校舎名称", "本部コード", "ブランドＩＤ"],
    searchableColumns: ["校舎コード", "校舎名称", "本部コード", "ブランドＩＤ"],
  },
  {
    key: "employees",
    label: "社員マスター",
    description: "社員番号、氏名、本部コード、人事区分を管理します。",
    fileName: "SHAIN.csv",
    storageName: "employees",
    requiredHeaders: ["社員番号", "姓", "名", "本部コード", "人事区分", "ブランドＩＤ"],
    primaryKey: ["社員番号"],
    previewColumns: ["社員番号", "姓", "名", "本部コード", "人事区分", "ブランドＩＤ"],
    searchableColumns: ["社員番号", "姓", "名", "本部コード", "人事区分", "ブランドＩＤ"],
  },
  {
    key: "employeeHeadquarterPermissions",
    label: "社員権限マスター（本部）",
    description: "社員が閲覧できる本部範囲を管理します。",
    fileName: "KANRIHONBU.csv",
    storageName: "employee_headquarter_permissions",
    requiredHeaders: ["社員番号", "本部コード"],
    primaryKey: ["社員番号", "本部コード"],
    previewColumns: ["社員番号", "本部コード"],
    searchableColumns: ["社員番号", "本部コード"],
  },
  {
    key: "employeeSchoolPermissions",
    label: "社員権限マスター（校舎）",
    description: "社員が閲覧できる校舎範囲を管理します。",
    fileName: "KANRIKOUSHA.csv",
    storageName: "employee_school_permissions",
    requiredHeaders: ["社員番号", "校舎コード"],
    primaryKey: ["社員番号", "校舎コード"],
    previewColumns: ["社員番号", "校舎コード"],
    searchableColumns: ["社員番号", "校舎コード"],
  },
  {
    key: "courseLineups",
    label: "講座ラインナップマスター",
    description: "共通テスト対策講座、大学別過去問添削講座などの講座ラインナップを管理します。",
    fileName: "LINEUP.csv",
    storageName: "course_lineups",
    requiredHeaders: ["年度", "授業区分", "講座種類", "講座コース", "講座コース名", "講座コース略名", "受講開始予定日", "受講終了予定日", "使用不可", "登録日時", "有効期間開始日", "有効期間終了日"],
    primaryKey: ["年度", "授業区分", "講座種類", "講座コース"],
    previewColumns: ["年度", "授業区分", "講座種類", "講座コース", "講座コース名", "講座コース略名", "使用不可"],
    searchableColumns: ["年度", "授業区分", "講座種類", "講座コース", "講座コース名", "講座コース略名"],
  },
  {
    key: "students",
    label: "生徒マスター",
    description: "生徒ID、所属校舎、学年、志望校、氏名、メールアドレスを管理します。",
    fileName: "SEITO.csv",
    storageName: "master_students",
    requiredHeaders: ["生徒ＩＤ", "学校区分", "学年区分", "高等部校舎コード", "姓", "名", "カナ姓", "カナ名", "メールアドレス", "志望校コード", "大学名", "学部名", "学科名", "ブランドＩＤ"],
    primaryKey: ["生徒ＩＤ"],
    previewColumns: ["生徒ＩＤ", "姓", "名", "学校区分", "学年区分", "高等部校舎コード", "志望校コード", "ブランドＩＤ"],
    searchableColumns: ["生徒ＩＤ", "姓", "名", "カナ姓", "カナ名", "メールアドレス", "大学名", "学部名", "学科名", "ブランドＩＤ"],
  },
  {
    key: "studentCourseEnrollments",
    label: "受講管理データ",
    description: "どの講座をどの生徒が受けているかを管理します。",
    fileName: "JUKOUKANRI.csv",
    storageName: "master_student_course_enrollments",
    requiredHeaders: ["年度", "授業区分", "講座種類", "講座コース区分", "生徒ＩＤ"],
    primaryKey: ["年度", "授業区分", "講座種類", "講座コース区分", "生徒ＩＤ"],
    previewColumns: ["年度", "授業区分", "講座種類", "講座コース区分", "生徒ＩＤ"],
    searchableColumns: ["年度", "授業区分", "講座種類", "講座コース区分", "生徒ＩＤ"],
  },
];

export const masterDefinitionMap = new Map(masterDefinitions.map((definition) => [definition.key, definition]));

export const bulkImportOrder: MasterKey[] = [
  "brands",
  "headquarters",
  "schools",
  "gradeMasters",
  "universities",
  "courseLineups",
  "employees",
  "employeeHeadquarterPermissions",
  "employeeSchoolPermissions",
  "students",
  "studentCourseEnrollments",
];

export const fileNameMasterMap = new Map(masterDefinitions.map((definition) => [definition.fileName.toUpperCase(), definition.key]));

function dataRoot() {
  return path.resolve(process.cwd(), "..", "data", "master-data");
}

function writableDataRoot() {
  if (process.env.VERCEL) return path.join("/tmp", "master-data");
  return dataRoot();
}

function masterFilePath(definition: MasterDefinition) {
  return path.join(dataRoot(), `${definition.storageName}.json`);
}

function writableMasterFilePath(definition: MasterDefinition) {
  return path.join(writableDataRoot(), `${definition.storageName}.json`);
}

function importLogPath() {
  return path.join(dataRoot(), "master_import_logs.json");
}

function writableImportLogPath() {
  return path.join(writableDataRoot(), "master_import_logs.json");
}

function pendingImportPath(id: string) {
  return path.join(dataRoot(), "pending-imports", `${id}.json`);
}

function writablePendingImportPath(id: string) {
  return path.join(writableDataRoot(), "pending-imports", `${id}.json`);
}

function blobEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function masterImportStorageReady() {
  return true;
}

export async function checkMasterImportStorage() {
  if (dbEnabled()) {
    const id = "master:storage_check";
    const payload = { checkedAt: new Date().toISOString() };
    try {
      await writeDbJson(id, payload);
      const stored = await readDbJson<typeof payload | null>(id, null);
      await deleteDbJson(id);
      return {
        ready: Boolean(stored?.checkedAt),
        provider: "postgres",
        message: stored?.checkedAt ? "Supabase/Postgresに接続できています。" : "Supabase/Postgresの読込確認に失敗しました。",
      };
    } catch (error) {
      return {
        ready: false,
        provider: "postgres",
        message: error instanceof Error ? `Supabase/Postgres接続に失敗しました: ${error.message}` : "Supabase/Postgres接続に失敗しました。",
      };
    }
  }

  if (blobEnabled()) {
    const id = "data/master-data/storage_check.json";
    const payload = { checkedAt: new Date().toISOString() };
    try {
      await writeBlobJson(id, payload);
      const stored = await readBlobJson<typeof payload | null>(id, null);
      await del(id);
      return {
        ready: Boolean(stored?.checkedAt),
        provider: "blob",
        message: stored?.checkedAt ? "Vercel Blobに接続できています。" : "Vercel Blobの読込確認に失敗しました。",
      };
    } catch (error) {
      return {
        ready: false,
        provider: "blob",
        message: error instanceof Error ? `Vercel Blob接続に失敗しました: ${error.message}` : "Vercel Blob接続に失敗しました。",
      };
    }
  }

  if (!process.env.VERCEL) {
    return { ready: true, provider: "file", message: "ローカルファイル保存で動作します。本番ではSupabase/Postgres接続が必要です。" };
  }

  return {
    ready: true,
    provider: "temporary-file",
    message: "一時ファイル保存で動作します。検証・取込テスト用の保存先のため、再デプロイや環境再起動で消える可能性があります。",
  };
}

function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
}

function dbEnabled() {
  return Boolean(databaseUrl());
}

function sqlClient() {
  return neon(databaseUrl());
}

let masterDocumentSchemaReady = false;

async function ensureMasterDocumentSchema() {
  if (masterDocumentSchemaReady || !dbEnabled()) return;
  const sql = sqlClient();
  await sql`
    CREATE TABLE IF NOT EXISTS master_data_documents (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  masterDocumentSchemaReady = true;
}

async function readDbJson<T>(id: string, fallback: T) {
  if (!dbEnabled()) return fallback;
  await ensureMasterDocumentSchema();
  const sql = sqlClient();
  const rows = await sql`SELECT data FROM master_data_documents WHERE id = ${id} LIMIT 1`;
  const data = rows[0]?.data;
  return data === undefined || data === null ? fallback : (data as T);
}

async function writeDbJson(id: string, value: unknown) {
  if (!dbEnabled()) return false;
  await ensureMasterDocumentSchema();
  const sql = sqlClient();
  await sql`
    INSERT INTO master_data_documents (id, data, updated_at)
    VALUES (${id}, ${JSON.stringify(value)}::jsonb, NOW())
    ON CONFLICT (id) DO UPDATE SET
      data = EXCLUDED.data,
      updated_at = NOW()
  `;
  return true;
}

async function deleteDbJson(id: string) {
  if (!dbEnabled()) return false;
  await ensureMasterDocumentSchema();
  const sql = sqlClient();
  await sql`DELETE FROM master_data_documents WHERE id = ${id}`;
  return true;
}

function masterBlobPath(definition: MasterDefinition) {
  return `data/master-data/${definition.storageName}.json`;
}

function masterDocumentId(definition: MasterDefinition) {
  return `master:${definition.storageName}`;
}

function importLogDocumentId() {
  return "master:import_logs";
}

function pendingImportDocumentId(id: string) {
  return `master:pending:${id}`;
}

function importLogBlobPath() {
  return "data/master-data/master_import_logs.json";
}

function pendingImportBlobPath(id: string) {
  return `data/master-data/pending-imports/${id}.json`;
}

async function readBlobJson<T>(blobPath: string, fallback: T) {
  if (!blobEnabled()) return fallback;
  try {
    const result = await get(blobPath, { access: "private" });
    if (!result || result.statusCode !== 200) return fallback;
    const text = await new Response(result.stream).text();
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

async function writeBlobJson(blobPath: string, value: unknown) {
  if (!blobEnabled()) return false;
  await put(blobPath, JSON.stringify(value, null, 2), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json; charset=utf-8",
  });
  return true;
}

export function getMasterDefinition(key: string) {
  return masterDefinitionMap.get(key as MasterKey) ?? null;
}

export function readMasterRecords(key: MasterKey) {
  const definition = masterDefinitionMap.get(key);
  if (!definition) return [];
  const writablePath = writableMasterFilePath(definition);
  if (process.env.VERCEL && fs.existsSync(writablePath)) {
    return readJsonFile<MasterRecord[]>(writablePath, []);
  }
  return readJsonFile<MasterRecord[]>(masterFilePath(definition), []);
}

export async function readMasterRecordsAsync(key: MasterKey) {
  const definition = masterDefinitionMap.get(key);
  if (!definition) return [];
  const bundled = readMasterRecords(key);
  if (dbEnabled()) {
    const records = await readDbJson<MasterRecord[]>(masterDocumentId(definition), bundled);
    if (process.env.VERCEL) writeJsonFileAtomic(writableMasterFilePath(definition), records);
    return records;
  }
  if (!blobEnabled()) return bundled;
  const records = await readBlobJson<MasterRecord[]>(masterBlobPath(definition), bundled);
  if (process.env.VERCEL) writeJsonFileAtomic(writableMasterFilePath(definition), records);
  return records;
}

export function writeMasterRecords(key: MasterKey, records: MasterRecord[]) {
  const definition = masterDefinitionMap.get(key);
  if (!definition) throw new Error(`Unknown master key: ${key}`);
  writeJsonFileAtomic(writableMasterFilePath(definition), records);
}

export async function writeMasterRecordsAsync(key: MasterKey, records: MasterRecord[]) {
  const definition = masterDefinitionMap.get(key);
  if (!definition) throw new Error(`Unknown master key: ${key}`);
  if (dbEnabled()) await writeDbJson(masterDocumentId(definition), records);
  else if (blobEnabled()) await writeBlobJson(masterBlobPath(definition), records);
  writeJsonFileAtomic(writableMasterFilePath(definition), records);
}

export function readImportLogs() {
  if (process.env.VERCEL && fs.existsSync(writableImportLogPath())) {
    return readJsonFile<MasterImportLog[]>(writableImportLogPath(), []);
  }
  return readJsonFile<MasterImportLog[]>(importLogPath(), []);
}

export async function readImportLogsAsync() {
  const bundled = readImportLogs();
  if (dbEnabled()) {
    const logs = await readDbJson<MasterImportLog[]>(importLogDocumentId(), bundled);
    if (process.env.VERCEL) writeJsonFileAtomic(writableImportLogPath(), logs);
    return logs;
  }
  if (!blobEnabled()) return bundled;
  const logs = await readBlobJson<MasterImportLog[]>(importLogBlobPath(), bundled);
  if (process.env.VERCEL) writeJsonFileAtomic(writableImportLogPath(), logs);
  return logs;
}

export function writeImportLogs(logs: MasterImportLog[]) {
  writeJsonFileAtomic(writableImportLogPath(), logs);
}

export async function writeImportLogsAsync(logs: MasterImportLog[]) {
  if (dbEnabled()) await writeDbJson(importLogDocumentId(), logs);
  else if (blobEnabled()) await writeBlobJson(importLogBlobPath(), logs);
  writeJsonFileAtomic(writableImportLogPath(), logs);
}

export function readPendingImport(id: string) {
  if (process.env.VERCEL && fs.existsSync(writablePendingImportPath(id))) {
    return readJsonFile<PendingImport | null>(writablePendingImportPath(id), null);
  }
  return readJsonFile<PendingImport | null>(pendingImportPath(id), null);
}

export async function readPendingImportAsync(id: string) {
  const local = readPendingImport(id);
  if (local) return local;
  if (dbEnabled()) {
    const pending = await readDbJson<PendingImport | null>(pendingImportDocumentId(id), null);
    if (pending && process.env.VERCEL) writeJsonFileAtomic(writablePendingImportPath(id), pending);
    return pending;
  }
  if (!blobEnabled()) return local;
  const pending = await readBlobJson<PendingImport | null>(pendingImportBlobPath(id), null);
  if (pending && process.env.VERCEL) writeJsonFileAtomic(writablePendingImportPath(id), pending);
  return pending;
}

export function writePendingImport(pending: PendingImport) {
  writeJsonFileAtomic(writablePendingImportPath(pending.id), pending);
}

export async function writePendingImportAsync(pending: PendingImport) {
  if (dbEnabled()) await writeDbJson(pendingImportDocumentId(pending.id), pending);
  else if (blobEnabled()) await writeBlobJson(pendingImportBlobPath(pending.id), pending);
  writeJsonFileAtomic(writablePendingImportPath(pending.id), pending);
}

export function deletePendingImport(id: string) {
  const filePath = writablePendingImportPath(id);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

export async function deletePendingImportAsync(id: string) {
  deletePendingImport(id);
  if (dbEnabled()) {
    await deleteDbJson(pendingImportDocumentId(id));
  } else if (blobEnabled()) {
    try {
      await del(pendingImportBlobPath(id));
    } catch {
      // Deleting a missing preview is harmless.
    }
  }
}

export function getRecordKey(definition: MasterDefinition, record: MasterRecord) {
  return definition.primaryKey.map((column) => record[column] ?? "").join("\u001f");
}

export function decodeCsvBuffer(buffer: Buffer) {
  const hasUtf8Bom = buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
  const decoder = new TextDecoder(hasUtf8Bom ? "utf-8" : "shift_jis", { fatal: false });
  return decoder.decode(buffer).replace(/^\uFEFF/, "");
}

export function parseMasterCsv(buffer: Buffer) {
  return parseCsv(decodeCsvBuffer(buffer));
}

export function parseMasterCsvWithEncodingIssues(buffer: Buffer) {
  const text = decodeCsvBuffer(buffer);
  const issues: ImportIssue[] = [];
  if (text.includes("\uFFFD")) {
    issues.push({ line: 1, level: "error", message: "不正な文字コードまたは変換できない文字が含まれています。" });
  }
  return { rows: parseCsv(text), issues };
}

function normalizeRecord(definition: MasterDefinition, row: CsvRow): MasterRecord {
  const record: MasterRecord = {};
  Object.keys(row).forEach((key) => {
    record[key.replace(/^\uFEFF/, "").trim()] = String(row[key] ?? "").trim();
  });
  definition.requiredHeaders.forEach((header) => {
    record[header] = record[header] ?? "";
  });
  return record;
}

function missingHeaders(definition: MasterDefinition, rows: CsvRow[]) {
  if (rows.length === 0) return definition.requiredHeaders;
  const headers = new Set(Object.keys(rows[0]).map((header) => header.replace(/^\uFEFF/, "").trim()));
  return definition.requiredHeaders.filter((header) => !headers.has(header));
}

function relationSet(key: MasterKey, columns: string[]) {
  return new Set(readMasterRecords(key).map((record) => columns.map((column) => record[column] ?? "").join("\u001f")));
}

function pushMissingRelation(issues: ImportIssue[], line: number, column: string, value: string, target: string) {
  if (!value) return;
  issues.push({ line, column, level: "warning", message: `${target} に存在しません: ${value}` });
}

function activeRecords(records: MasterRecord[]) {
  return records.filter((record) => record.is_active !== "false");
}

function recordSet(records: MasterRecord[], columns: string[]) {
  return new Set(activeRecords(records).map((record) => columns.map((column) => record[column] ?? "").join("\u001f")));
}

function recordsDiffer(before: MasterRecord | undefined, after: MasterRecord) {
  if (!before) return true;
  const columns = new Set([...Object.keys(before), ...Object.keys(after)]);
  columns.delete("is_active");
  return Array.from(columns).some((column) => String(before[column] ?? "") !== String(after[column] ?? ""));
}

function relationRecords(key: MasterKey, sources?: Map<MasterKey, MasterRecord[]>) {
  return sources?.get(key) ?? readMasterRecords(key);
}

function pushMissingRelationError(issues: ImportIssue[], line: number, column: string, value: string, target: string) {
  if (!value) return;
  issues.push({ line, column, level: "error", message: `${target} に存在しません: ${value}` });
}

function validateCodeLengths(definition: MasterDefinition, record: MasterRecord, line: number, issues: ImportIssue[]) {
  const targetColumns = [
    ...definition.primaryKey,
    ...definition.requiredHeaders.filter((column) => column.includes("コード") || column.includes("番号") || column.includes("ID") || column.includes("ＩＤ")),
  ];
  Array.from(new Set(targetColumns)).forEach((column) => {
    const value = record[column] ?? "";
    if (value.length > 64) {
      issues.push({ line, column, level: "error", message: "コード桁数が上限を超えています。" });
    }
  });
}

function validateStrictRelations(definition: MasterDefinition, record: MasterRecord, line: number, issues: ImportIssue[], sources?: Map<MasterKey, MasterRecord[]>) {
  if (["headquarters", "schools", "employees", "students"].includes(definition.key)) {
    const brands = recordSet(relationRecords("brands", sources), ["ID"]);
    if (!brands.has(record["ブランドＩＤ"])) pushMissingRelationError(issues, line, "ブランドＩＤ", record["ブランドＩＤ"], "BRAND.csv");
  }
  if (definition.key === "schools") {
    const headquarters = recordSet(relationRecords("headquarters", sources), ["本部コード"]);
    if (!headquarters.has(record["本部コード"])) pushMissingRelationError(issues, line, "本部コード", record["本部コード"], "HONBU.csv");
  }
  if (definition.key === "employees") {
    const headquarters = recordSet(relationRecords("headquarters", sources), ["本部コード"]);
    if (!headquarters.has(record["本部コード"])) pushMissingRelationError(issues, line, "本部コード", record["本部コード"], "HONBU.csv");
  }
  if (definition.key === "employeeHeadquarterPermissions") {
    const employees = recordSet(relationRecords("employees", sources), ["社員番号"]);
    const headquarters = recordSet(relationRecords("headquarters", sources), ["本部コード"]);
    if (!employees.has(record["社員番号"])) pushMissingRelationError(issues, line, "社員番号", record["社員番号"], "SHAIN.csv");
    if (!headquarters.has(record["本部コード"])) pushMissingRelationError(issues, line, "本部コード", record["本部コード"], "HONBU.csv");
  }
  if (definition.key === "employeeSchoolPermissions") {
    const employees = recordSet(relationRecords("employees", sources), ["社員番号"]);
    const schools = recordSet(relationRecords("schools", sources), ["校舎コード"]);
    if (!employees.has(record["社員番号"])) pushMissingRelationError(issues, line, "社員番号", record["社員番号"], "SHAIN.csv");
    if (!schools.has(record["校舎コード"])) pushMissingRelationError(issues, line, "校舎コード", record["校舎コード"], "KOUSHA.csv");
  }
  if (definition.key === "students") {
    const schools = recordSet(relationRecords("schools", sources), ["校舎コード"]);
    const universities = recordSet(relationRecords("universities", sources), ["コード"]);
    if (!schools.has(record["高等部校舎コード"])) pushMissingRelationError(issues, line, "高等部校舎コード", record["高等部校舎コード"], "KOUSHA.csv");
    if (record["志望校コード"] && !universities.has(record["志望校コード"])) pushMissingRelationError(issues, line, "志望校コード", record["志望校コード"], "DAIGAKU.csv");
  }
  if (definition.key === "studentCourseEnrollments") {
    const students = recordSet(relationRecords("students", sources), ["生徒ＩＤ"]);
    const lineups = recordSet(relationRecords("courseLineups", sources), ["年度", "授業区分", "講座種類", "講座コース"]);
    const lineupKey = [record["年度"], record["授業区分"], record["講座種類"], record["講座コース区分"]].join("\u001f");
    if (!students.has(record["生徒ＩＤ"])) pushMissingRelationError(issues, line, "生徒ＩＤ", record["生徒ＩＤ"], "SEITO.csv");
    if (!lineups.has(lineupKey)) {
      issues.push({ line, column: "講座コース区分", level: "error", message: `LINEUP.csv に存在しない講座キーです: ${lineupKey.replace(/\u001f/g, " / ")}` });
    }
  }
}

function validateRelations(definition: MasterDefinition, record: MasterRecord, line: number, issues: ImportIssue[]) {
  if (["headquarters", "schools", "employees", "students"].includes(definition.key)) {
    const brands = relationSet("brands", ["ID"]);
    if (!brands.has(record["ブランドＩＤ"])) pushMissingRelation(issues, line, "ブランドＩＤ", record["ブランドＩＤ"], "BRAND");
  }
  if (definition.key === "schools") {
    const headquarters = relationSet("headquarters", ["本部コード"]);
    if (!headquarters.has(record["本部コード"])) pushMissingRelation(issues, line, "本部コード", record["本部コード"], "HONBU");
  }
  if (definition.key === "students") {
    const schools = relationSet("schools", ["校舎コード"]);
    const grades = relationSet("gradeMasters", ["学校区分", "学年区分"]);
    const universities = relationSet("universities", ["コード"]);
    if (!schools.has(record["高等部校舎コード"])) pushMissingRelation(issues, line, "高等部校舎コード", record["高等部校舎コード"], "KOUSHA");
    if (!grades.has(`${record["学校区分"]}\u001f${record["学年区分"]}`)) {
      issues.push({ line, column: "学校区分/学年区分", level: "warning", message: "GAKUNEN に存在しない学校区分 + 学年区分です。" });
    }
    if (record["志望校コード"] && !universities.has(record["志望校コード"])) pushMissingRelation(issues, line, "志望校コード", record["志望校コード"], "DAIGAKU");
  }
  if (definition.key === "studentCourseEnrollments") {
    const students = relationSet("students", ["生徒ＩＤ"]);
    const lineups = relationSet("courseLineups", ["年度", "授業区分", "講座種類", "講座コース"]);
    const lineupKey = [record["年度"], record["授業区分"], record["講座種類"], record["講座コース区分"]].join("\u001f");
    if (!students.has(record["生徒ＩＤ"])) pushMissingRelation(issues, line, "生徒ＩＤ", record["生徒ＩＤ"], "SEITO");
    if (!lineups.has(lineupKey)) {
      issues.push({ line, column: "講座コース区分", level: "warning", message: "LINEUP に存在しない講座キーです。" });
    }
  }
  if (definition.key === "employeeHeadquarterPermissions") {
    const employees = relationSet("employees", ["社員番号"]);
    const headquarters = relationSet("headquarters", ["本部コード"]);
    if (!employees.has(record["社員番号"])) pushMissingRelation(issues, line, "社員番号", record["社員番号"], "SHAIN");
    if (!headquarters.has(record["本部コード"])) pushMissingRelation(issues, line, "本部コード", record["本部コード"], "HONBU");
  }
  if (definition.key === "employeeSchoolPermissions") {
    const employees = relationSet("employees", ["社員番号"]);
    const schools = relationSet("schools", ["校舎コード"]);
    if (!employees.has(record["社員番号"])) pushMissingRelation(issues, line, "社員番号", record["社員番号"], "SHAIN");
    if (!schools.has(record["校舎コード"])) pushMissingRelation(issues, line, "校舎コード", record["校舎コード"], "KOUSHA");
  }
}

export function validateImport(
  definition: MasterDefinition,
  rows: CsvRow[],
  existingRecords = readMasterRecords(definition.key),
  sources?: Map<MasterKey, MasterRecord[]>,
  initialIssues: ImportIssue[] = [],
) {
  const issues: ImportIssue[] = [...initialIssues];
  const missing = missingHeaders(definition, rows);
  missing.forEach((column) => {
    issues.push({ line: 1, column, level: "error", message: `必須ヘッダーが不足しています: ${column}` });
  });

  if (rows.length === 0) {
    issues.push({ line: 1, level: "error", message: "CSVにデータ行がありません。" });
  }

  const existingByKey = new Map(activeRecords(existingRecords).map((record) => [getRecordKey(definition, record), record]));
  const existingKeys = new Set(existingByKey.keys());
  const seenKeys = new Set<string>();
  const records: MasterRecord[] = [];
  const skippedKeys: string[] = [];
  let addCount = 0;
  let updateCount = 0;
  let skipCount = 0;

  rows.forEach((row, index) => {
    const line = index + 2;
    const record = normalizeRecord(definition, row);
    const key = getRecordKey(definition, record);
    const rowIssues: ImportIssue[] = [];

    definition.primaryKey.forEach((column) => {
      if (!record[column]) {
        rowIssues.push({ line, column, level: "error", message: `主キー項目が空です: ${column}` });
      }
    });

    if (seenKeys.has(key)) {
      rowIssues.push({ line, level: "error", message: "同じCSV内に重複した主キーがあります。" });
    }
    seenKeys.add(key);
    validateCodeLengths(definition, record, line, rowIssues);
    if (sources) validateStrictRelations(definition, record, line, rowIssues, sources);
    else validateRelations(definition, record, line, rowIssues);
    if (!key.replace(/\u001f/g, "")) {
      issues.push(...rowIssues.map((issue) => ({ ...issue, record, level: "warning" as const, message: `スキップ: ${issue.message}` })));
      skipCount += 1;
      return;
    }
    const hasRowError = rowIssues.some((issue) => issue.level === "error");
    if (hasRowError) {
      skippedKeys.push(key);
      issues.push(...rowIssues.map((issue) => ({ ...issue, record, message: `スキップ: ${issue.message}` })));
      skipCount += 1;
      return;
    }
    issues.push(...rowIssues);
    records.push(record);
    if (existingKeys.has(key)) {
      if (recordsDiffer(existingByKey.get(key), record)) updateCount += 1;
    }
    else addCount += 1;
  });

  const incomingKeys = new Set(records.map((record) => getRecordKey(definition, record)));
  const skippedKeySet = new Set(skippedKeys);
  const disabledCount = Array.from(existingKeys).filter((key) => !incomingKeys.has(key) && !skippedKeySet.has(key)).length;

  const errorCount = issues.filter((issue) => issue.level === "error").length;
  const warningCount = issues.filter((issue) => issue.level === "warning").length;

  return {
    records,
    skippedKeys,
    issues,
    summary: {
      totalRows: rows.length,
      addCount,
      updateCount,
      disabledCount,
      skipCount,
      errorCount,
      warningCount,
    } satisfies ImportSummary,
  };
}

export function commitImport(pending: PendingImport, importedBy: string) {
  const definition = masterDefinitionMap.get(pending.masterKey);
  if (!definition) throw new Error(`Unknown master key: ${pending.masterKey}`);

  const existingRecords = readMasterRecords(pending.masterKey);
  const byKey = new Map(existingRecords.map((record) => [getRecordKey(definition, record), record]));
  const incomingKeys = new Set(pending.records.map((record) => getRecordKey(definition, record)));
  const skippedKeys = new Set(pending.skippedKeys ?? []);
  byKey.forEach((record, key) => {
    if (!incomingKeys.has(key) && !skippedKeys.has(key) && record.is_active !== "false") {
      byKey.set(key, { ...record, is_active: "false" });
    }
  });
  pending.records.forEach((record) => byKey.set(getRecordKey(definition, record), { ...record, is_active: "true" }));
  const nextRecords = Array.from(byKey.values());
  writeMasterRecords(pending.masterKey, nextRecords);

  const log: MasterImportLog = {
    ...pending.summary,
    id: crypto.randomUUID(),
    batchId: pending.batchId,
    masterKey: pending.masterKey,
    masterLabel: definition.label,
    fileName: pending.fileName,
    importedAt: new Date().toISOString(),
    importedBy,
    status: pending.summary.errorCount > 0 ? "failed" : "success",
    issues: pending.issues.slice(0, 200),
  };
  writeImportLogs([log, ...readImportLogs()].slice(0, 200));
  deletePendingImport(pending.id);
  return { log, totalCount: activeRecords(nextRecords).length };
}

export async function commitImportAsync(pending: PendingImport, importedBy: string) {
  const definition = masterDefinitionMap.get(pending.masterKey);
  if (!definition) throw new Error(`Unknown master key: ${pending.masterKey}`);

  const existingRecords = await readMasterRecordsAsync(pending.masterKey);
  const byKey = new Map(existingRecords.map((record) => [getRecordKey(definition, record), record]));
  const incomingKeys = new Set(pending.records.map((record) => getRecordKey(definition, record)));
  const skippedKeys = new Set(pending.skippedKeys ?? []);
  byKey.forEach((record, key) => {
    if (!incomingKeys.has(key) && !skippedKeys.has(key) && record.is_active !== "false") {
      byKey.set(key, { ...record, is_active: "false" });
    }
  });
  pending.records.forEach((record) => byKey.set(getRecordKey(definition, record), { ...record, is_active: "true" }));
  const nextRecords = Array.from(byKey.values());
  await writeMasterRecordsAsync(pending.masterKey, nextRecords);

  const log: MasterImportLog = {
    ...pending.summary,
    id: crypto.randomUUID(),
    batchId: pending.batchId,
    masterKey: pending.masterKey,
    masterLabel: definition.label,
    fileName: pending.fileName,
    importedAt: new Date().toISOString(),
    importedBy,
    status: pending.summary.errorCount > 0 ? "failed" : "success",
    issues: pending.issues.slice(0, 200),
  };
  const logs = await readImportLogsAsync();
  await writeImportLogsAsync([log, ...logs].slice(0, 200));
  await deletePendingImportAsync(pending.id);
  return { log, totalCount: activeRecords(nextRecords).length };
}

export function createPendingImport(masterKey: MasterKey, fileName: string, createdBy: string, records: MasterRecord[], summary: ImportSummary, issues: ImportIssue[], skippedKeys: string[] = []) {
  const pending: PendingImport = {
    id: crypto.randomUUID(),
    masterKey,
    fileName,
    createdAt: new Date().toISOString(),
    createdBy,
    records,
    skippedKeys,
    summary,
    issues,
  };
  writePendingImport(pending);
  return pending;
}

export async function createPendingImportAsync(masterKey: MasterKey, fileName: string, createdBy: string, records: MasterRecord[], summary: ImportSummary, issues: ImportIssue[], skippedKeys: string[] = []) {
  const pending: PendingImport = {
    id: crypto.randomUUID(),
    masterKey,
    fileName,
    createdAt: new Date().toISOString(),
    createdBy,
    records,
    skippedKeys,
    summary,
    issues,
  };
  await writePendingImportAsync(pending);
  return pending;
}

export function createPendingImportWithBatch(
  masterKey: MasterKey,
  fileName: string,
  createdBy: string,
  records: MasterRecord[],
  summary: ImportSummary,
  issues: ImportIssue[],
  batchId?: string,
  skippedKeys: string[] = [],
) {
  const pending = createPendingImport(masterKey, fileName, createdBy, records, summary, issues, skippedKeys);
  pending.batchId = batchId;
  writePendingImport(pending);
  return pending;
}

export async function createPendingImportWithBatchAsync(
  masterKey: MasterKey,
  fileName: string,
  createdBy: string,
  records: MasterRecord[],
  summary: ImportSummary,
  issues: ImportIssue[],
  batchId?: string,
  skippedKeys: string[] = [],
) {
  const pending = await createPendingImportAsync(masterKey, fileName, createdBy, records, summary, issues, skippedKeys);
  pending.batchId = batchId;
  await writePendingImportAsync(pending);
  return pending;
}

export function mergeImportedRecords(definition: MasterDefinition, existingRecords: MasterRecord[], importedRecords: MasterRecord[]) {
  const byKey = new Map(existingRecords.map((record) => [getRecordKey(definition, record), record]));
  const incomingKeys = new Set(importedRecords.map((record) => getRecordKey(definition, record)));
  byKey.forEach((record, key) => {
    if (!incomingKeys.has(key)) byKey.set(key, { ...record, is_active: "false" });
  });
  importedRecords.forEach((record) => byKey.set(getRecordKey(definition, record), { ...record, is_active: "true" }));
  return Array.from(byKey.values());
}

export function buildImportDiffRows(definition: MasterDefinition, importedRecords: MasterRecord[], issues: ImportIssue[]) {
  const existingRecords = activeRecords(readMasterRecords(definition.key));
  return buildImportDiffRowsFromExisting(definition, existingRecords, importedRecords, issues);
}

export async function buildImportDiffRowsAsync(definition: MasterDefinition, importedRecords: MasterRecord[], issues: ImportIssue[]) {
  const existingRecords = activeRecords(await readMasterRecordsAsync(definition.key));
  return buildImportDiffRowsFromExisting(definition, existingRecords, importedRecords, issues);
}

function buildImportDiffRowsFromExisting(definition: MasterDefinition, existingRecords: MasterRecord[], importedRecords: MasterRecord[], issues: ImportIssue[]) {
  const existingByKey = new Map(existingRecords.map((record) => [getRecordKey(definition, record), record]));
  const incomingByKey = new Map(importedRecords.map((record) => [getRecordKey(definition, record), record]));
  const rows: ImportDiffRow[] = [];

  issues
    .filter((issue) => issue.level === "error")
    .slice(0, 400)
    .forEach((issue) => {
      const key = issue.record ? getRecordKey(definition, issue.record).replace(/\u001f/g, " / ") : "";
      rows.push({
        masterKey: definition.key,
        masterLabel: definition.label,
        primaryKey: key || issue.column || `行${issue.line}`,
        changeType: "エラー",
        before: null,
        after: issue.record ?? null,
        reason: `行${issue.line}: ${issue.message}`,
      });
    });

  issues
    .filter((issue) => issue.level === "warning" && issue.message.startsWith("スキップ:"))
    .slice(0, 400)
    .forEach((issue) => {
      const key = issue.record ? getRecordKey(definition, issue.record).replace(/\u001f/g, " / ") : "";
      rows.push({
        masterKey: definition.key,
        masterLabel: definition.label,
        primaryKey: key || issue.column || `行${issue.line}`,
        changeType: "スキップ",
        before: null,
        after: issue.record ?? null,
        reason: `行${issue.line}: ${issue.message}`,
      });
    });

  importedRecords.slice(0, 500).forEach((record) => {
    const key = getRecordKey(definition, record);
    const before = existingByKey.get(key);
    if (before && !recordsDiffer(before, record)) return;
    rows.push({
      masterKey: definition.key,
      masterLabel: definition.label,
      primaryKey: key.replace(/\u001f/g, " / "),
      changeType: existingByKey.has(key) ? "更新" : "追加",
      before: existingByKey.get(key) ?? null,
      after: record,
    });
  });

  existingRecords.forEach((record) => {
    const key = getRecordKey(definition, record);
    if (!incomingByKey.has(key)) {
      rows.push({
        masterKey: definition.key,
        masterLabel: definition.label,
        primaryKey: key.replace(/\u001f/g, " / "),
        changeType: "無効化候補",
        before: record,
        after: { ...record, is_active: "false" },
      });
    }
  });

  return rows.slice(0, 1000);
}

export function masterKeyFromFileName(fileName: string) {
  return fileNameMasterMap.get(path.basename(fileName).toUpperCase()) ?? null;
}

export function masterSummary(definition: MasterDefinition) {
  const records = activeRecords(readMasterRecords(definition.key));
  const logs = readImportLogs().filter((log) => log.masterKey === definition.key);
  return masterSummaryFromRecords(definition, records, logs);
}

export async function masterSummaryAsync(definition: MasterDefinition) {
  const records = activeRecords(await readMasterRecordsAsync(definition.key));
  const logs = (await readImportLogsAsync()).filter((log) => log.masterKey === definition.key);
  return masterSummaryFromRecords(definition, records, logs);
}

function masterSummaryFromRecords(definition: MasterDefinition, records: MasterRecord[], logs: MasterImportLog[]) {
  const latest = logs[0] ?? null;
  return {
    key: definition.key,
    label: definition.label,
    description: definition.description,
    fileName: definition.fileName,
    primaryKey: definition.primaryKey,
    previewColumns: definition.previewColumns,
    requiredHeaders: definition.requiredHeaders,
    rowCount: records.length,
    lastImportedAt: latest?.importedAt ?? null,
    importedCount: latest ? latest.addCount + latest.updateCount : 0,
    errorCount: latest?.errorCount ?? 0,
  };
}

export function queryMasterRecords(definition: MasterDefinition, query: string, page: number, pageSize: number) {
  return queryMasterRecordsFromRows(definition, activeRecords(readMasterRecords(definition.key)), query, page, pageSize);
}

export async function queryMasterRecordsAsync(definition: MasterDefinition, query: string, page: number, pageSize: number) {
  return queryMasterRecordsFromRows(definition, activeRecords(await readMasterRecordsAsync(definition.key)), query, page, pageSize);
}

function queryMasterRecordsFromRows(definition: MasterDefinition, allRecords: MasterRecord[], query: string, page: number, pageSize: number) {
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? allRecords.filter((record) =>
        definition.searchableColumns.some((column) => String(record[column] ?? "").toLowerCase().includes(normalizedQuery)),
      )
    : allRecords;
  const total = filtered.length;
  const safePageSize = Math.max(10, Math.min(200, pageSize || 50));
  const safePage = Math.max(1, page || 1);
  const start = (safePage - 1) * safePageSize;
  return {
    records: filtered.slice(start, start + safePageSize),
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages: Math.max(1, Math.ceil(total / safePageSize)),
  };
}

function csvEscape(value: string) {
  return `"${value.replace(/"/g, "\"\"")}"`;
}

export function exportMasterCsv(definition: MasterDefinition) {
  const records = activeRecords(readMasterRecords(definition.key));
  return exportMasterCsvFromRows(definition, records);
}

export async function exportMasterCsvAsync(definition: MasterDefinition) {
  const records = activeRecords(await readMasterRecordsAsync(definition.key));
  return exportMasterCsvFromRows(definition, records);
}

function exportMasterCsvFromRows(definition: MasterDefinition, records: MasterRecord[]) {
  const extraHeaders = Array.from(new Set(records.flatMap((record) => Object.keys(record)))).filter((header) => header !== "is_active" && !definition.requiredHeaders.includes(header));
  const headers = [...definition.requiredHeaders, ...extraHeaders];
  const lines = [
    headers.map(csvEscape).join(","),
    ...records.map((record) => headers.map((header) => csvEscape(String(record[header] ?? ""))).join(",")),
  ];
  return `\uFEFF${lines.join("\r\n")}`;
}

function displayName(record: MasterRecord) {
  return [record["姓"], record["名"]].filter(Boolean).join(" ").trim();
}

function compositeKey(record: MasterRecord, columns: string[]) {
  return columns.map((column) => record[column] ?? "").join("\u001f");
}

function normalizedCourseCategory(courseCode: string) {
  return courseCode === "01" ? "共通テスト演習" : "大学別過去問添削";
}

function courseNameFromLineup(lineup: MasterRecord | undefined, fallback: string) {
  return lineup?.["講座コース名"] || lineup?.["講座コース略名"] || fallback;
}

function normalizeGradeLabel(value?: string) {
  return (value ?? "").replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0));
}

export function visibleSchoolCodesForEmployee(employeeId: string, isAdmin: boolean) {
  const schools = activeRecords(readMasterRecords("schools"));
  const schoolPermissions = activeRecords(readMasterRecords("employeeSchoolPermissions"));
  const headquarterPermissions = activeRecords(readMasterRecords("employeeHeadquarterPermissions"));
  return visibleSchoolCodesForEmployeeFromRecords(employeeId, isAdmin, schools, schoolPermissions, headquarterPermissions);
}

export async function visibleSchoolCodesForEmployeeAsync(employeeId: string, isAdmin: boolean) {
  const [schools, schoolPermissions, headquarterPermissions] = await Promise.all([
    readMasterRecordsAsync("schools"),
    readMasterRecordsAsync("employeeSchoolPermissions"),
    readMasterRecordsAsync("employeeHeadquarterPermissions"),
  ]);
  return visibleSchoolCodesForEmployeeFromRecords(
    employeeId,
    isAdmin,
    activeRecords(schools),
    activeRecords(schoolPermissions),
    activeRecords(headquarterPermissions),
  );
}

function visibleSchoolCodesForEmployeeFromRecords(
  employeeId: string,
  isAdmin: boolean,
  schools: MasterRecord[],
  schoolPermissionRecords: MasterRecord[],
  headquarterPermissionRecords: MasterRecord[],
) {
  if (isAdmin) return new Set(schools.map((school) => school["校舎コード"]).filter(Boolean));

  const schoolPermissions = schoolPermissionRecords
    .filter((permission) => permission["社員番号"] === employeeId)
    .map((permission) => permission["校舎コード"])
    .filter(Boolean);

  const headquarterPermissions = new Set(
    headquarterPermissionRecords
      .filter((permission) => permission["社員番号"] === employeeId)
      .map((permission) => permission["本部コード"])
      .filter(Boolean),
  );

  const schoolCodesFromHeadquarters = schools
    .filter((school) => headquarterPermissions.has(school["本部コード"]))
    .map((school) => school["校舎コード"])
    .filter(Boolean);

  return new Set([...schoolPermissions, ...schoolCodesFromHeadquarters]);
}

export function readVisibleMasterStudents(employeeId: string, isAdmin: boolean) {
  const masterStudents = activeRecords(readMasterRecords("students"));
  if (masterStudents.length === 0) return null;

  const schools = new Map(activeRecords(readMasterRecords("schools")).map((school) => [school["校舎コード"], school]));
  const headquarters = new Map(activeRecords(readMasterRecords("headquarters")).map((headquarter) => [headquarter["本部コード"], headquarter]));
  const grades = new Map(activeRecords(readMasterRecords("gradeMasters")).map((grade) => [compositeKey(grade, ["学校区分", "学年区分"]), grade]));
  const visibleSchools = visibleSchoolCodesForEmployee(employeeId, isAdmin);
  return mapVisibleMasterStudents(masterStudents, schools, headquarters, grades, visibleSchools, isAdmin);
}

export async function readVisibleMasterStudentsAsync(employeeId: string, isAdmin: boolean) {
  const [
    students,
    schoolsRecords,
    headquartersRecords,
    gradeRecords,
    schoolPermissionRecords,
    headquarterPermissionRecords,
  ] = await Promise.all([
    readMasterRecordsAsync("students"),
    readMasterRecordsAsync("schools"),
    readMasterRecordsAsync("headquarters"),
    readMasterRecordsAsync("gradeMasters"),
    readMasterRecordsAsync("employeeSchoolPermissions"),
    readMasterRecordsAsync("employeeHeadquarterPermissions"),
  ]);
  const masterStudents = activeRecords(students);
  if (masterStudents.length === 0) return null;

  const activeSchools = activeRecords(schoolsRecords);
  const schools = new Map(activeSchools.map((school) => [school["校舎コード"], school]));
  const headquarters = new Map(activeRecords(headquartersRecords).map((headquarter) => [headquarter["本部コード"], headquarter]));
  const grades = new Map(activeRecords(gradeRecords).map((grade) => [compositeKey(grade, ["学校区分", "学年区分"]), grade]));
  const visibleSchools = visibleSchoolCodesForEmployeeFromRecords(
    employeeId,
    isAdmin,
    activeSchools,
    activeRecords(schoolPermissionRecords),
    activeRecords(headquarterPermissionRecords),
  );
  return mapVisibleMasterStudents(masterStudents, schools, headquarters, grades, visibleSchools, isAdmin);
}

function mapVisibleMasterStudents(
  masterStudents: MasterRecord[],
  schools: Map<string, MasterRecord>,
  headquarters: Map<string, MasterRecord>,
  grades: Map<string, MasterRecord>,
  visibleSchools: Set<string>,
  isAdmin: boolean,
) {
  return masterStudents
    .filter((student) => isAdmin || visibleSchools.has(student["高等部校舎コード"]))
    .map((student) => {
      const school = schools.get(student["高等部校舎コード"]);
      const grade = grades.get(compositeKey(student, ["学校区分", "学年区分"]));
      const goal = [student["大学名"], student["学部名"], student["学科名"]].filter(Boolean).join(" ");
      const name = displayName(student);
      return {
        id: student["生徒ＩＤ"],
        name,
        nickname: name || student["生徒ＩＤ"],
        displayName: name || student["生徒ＩＤ"],
        email: student["メールアドレス"] ?? "",
        target: goal,
        group: school ? (headquarters.get(school["本部コード"])?.["本部名称"] ?? school["本部コード"] ?? "") : "",
        campus: school?.["校舎名称"] ?? student["高等部校舎コード"] ?? "",
        grade: normalizeGradeLabel(grade?.["学年"]),
        setupComplete: false,
      };
    });
}

export function readMasterCourseManagement(employeeId: string, isAdmin: boolean) {
  const courseLineups = activeRecords(readMasterRecords("courseLineups"));
  const enrollments = activeRecords(readMasterRecords("studentCourseEnrollments"));
  if (courseLineups.length === 0 && enrollments.length === 0) return null;

  const visibleStudentIds = new Set((readVisibleMasterStudents(employeeId, isAdmin) ?? []).map((student) => student.id));
  const studentsById = new Map(activeRecords(readMasterRecords("students")).map((student) => [student["生徒ＩＤ"], student]));
  const lineupsByKey = new Map(courseLineups.map((lineup) => [compositeKey(lineup, ["年度", "授業区分", "講座種類", "講座コース"]), lineup]));
  const schools = new Map(activeRecords(readMasterRecords("schools")).map((school) => [school["校舎コード"], school]));
  const headquarters = new Map(activeRecords(readMasterRecords("headquarters")).map((headquarter) => [headquarter["本部コード"], headquarter]));
  const grades = new Map(activeRecords(readMasterRecords("gradeMasters")).map((grade) => [compositeKey(grade, ["学校区分", "学年区分"]), grade]));
  return mapMasterCourseManagement(courseLineups, enrollments, visibleStudentIds, studentsById, lineupsByKey, schools, headquarters, grades, isAdmin);
}

export async function readMasterCourseManagementAsync(employeeId: string, isAdmin: boolean) {
  const [
    courseLineupRecords,
    enrollmentRecords,
    students,
    schoolsRecords,
    headquartersRecords,
    gradeRecords,
    visibleStudents,
  ] = await Promise.all([
    readMasterRecordsAsync("courseLineups"),
    readMasterRecordsAsync("studentCourseEnrollments"),
    readMasterRecordsAsync("students"),
    readMasterRecordsAsync("schools"),
    readMasterRecordsAsync("headquarters"),
    readMasterRecordsAsync("gradeMasters"),
    readVisibleMasterStudentsAsync(employeeId, isAdmin),
  ]);
  const courseLineups = activeRecords(courseLineupRecords);
  const enrollments = activeRecords(enrollmentRecords);
  if (courseLineups.length === 0 && enrollments.length === 0) return null;

  const visibleStudentIds = new Set((visibleStudents ?? []).map((student) => student.id));
  const studentsById = new Map(activeRecords(students).map((student) => [student["生徒ＩＤ"], student]));
  const lineupsByKey = new Map(courseLineups.map((lineup) => [compositeKey(lineup, ["年度", "授業区分", "講座種類", "講座コース"]), lineup]));
  const schools = new Map(activeRecords(schoolsRecords).map((school) => [school["校舎コード"], school]));
  const headquarters = new Map(activeRecords(headquartersRecords).map((headquarter) => [headquarter["本部コード"], headquarter]));
  const grades = new Map(activeRecords(gradeRecords).map((grade) => [compositeKey(grade, ["学校区分", "学年区分"]), grade]));
  return mapMasterCourseManagement(courseLineups, enrollments, visibleStudentIds, studentsById, lineupsByKey, schools, headquarters, grades, isAdmin);
}

function mapMasterCourseManagement(
  courseLineups: MasterRecord[],
  enrollments: MasterRecord[],
  visibleStudentIds: Set<string>,
  studentsById: Map<string, MasterRecord>,
  lineupsByKey: Map<string, MasterRecord>,
  schools: Map<string, MasterRecord>,
  headquarters: Map<string, MasterRecord>,
  grades: Map<string, MasterRecord>,
  isAdmin: boolean,
) {
  const courses = courseLineups.map((lineup) => ({
    code: lineup["講座コース"],
    name: courseNameFromLineup(lineup, lineup["講座コース"]),
    category: normalizedCourseCategory(lineup["講座コース"]),
  }));

  const mappedEnrollments = enrollments
    .filter((enrollment) => isAdmin || visibleStudentIds.has(enrollment["生徒ＩＤ"]))
    .map((enrollment) => {
      const student = studentsById.get(enrollment["生徒ＩＤ"]);
      const lineupKey = [enrollment["年度"], enrollment["授業区分"], enrollment["講座種類"], enrollment["講座コース区分"]].join("\u001f");
      const lineup = lineupsByKey.get(lineupKey);
      const school = student ? schools.get(student["高等部校舎コード"]) : undefined;
      const grade = student ? grades.get(compositeKey(student, ["学校区分", "学年区分"])) : undefined;
      return {
        studentId: enrollment["生徒ＩＤ"],
        nickname: student ? displayName(student) || enrollment["生徒ＩＤ"] : enrollment["生徒ＩＤ"],
        group: school ? (headquarters.get(school["本部コード"])?.["本部名称"] ?? school["本部コード"] ?? "") : "",
        campus: school?.["校舎名称"] ?? student?.["高等部校舎コード"] ?? "",
        grade: normalizeGradeLabel(grade?.["学年"]),
        goalUniversity: student?.["大学名"] ?? "",
        goalFaculty: student?.["学部名"] ?? "",
        goalDepartment: student?.["学科名"] ?? "",
        courseCode: enrollment["講座コース区分"],
        courseName: courseNameFromLineup(lineup, enrollment["講座コース区分"]),
        courseCategory: normalizedCourseCategory(enrollment["講座コース区分"]),
        year: enrollment["年度"],
        note: "マスター取込データ",
      };
    });

  return { courses, enrollments: mappedEnrollments, scores: [], hasMasterEnrollments: enrollments.length > 0 };
}

export function readMasterStudentCourseEnrollmentsForProfile(studentId?: string) {
  const enrollments = activeRecords(readMasterRecords("studentCourseEnrollments"));
  if (enrollments.length === 0) return null;

  const studentsById = new Map(activeRecords(readMasterRecords("students")).map((student) => [student["生徒ＩＤ"], student]));
  const lineupsByKey = new Map(
    activeRecords(readMasterRecords("courseLineups")).map((lineup) => [compositeKey(lineup, ["年度", "授業区分", "講座種類", "講座コース"]), lineup]),
  );
  const schools = new Map(activeRecords(readMasterRecords("schools")).map((school) => [school["校舎コード"], school]));
  const headquarters = new Map(activeRecords(readMasterRecords("headquarters")).map((headquarter) => [headquarter["本部コード"], headquarter]));
  const grades = new Map(activeRecords(readMasterRecords("gradeMasters")).map((grade) => [compositeKey(grade, ["学校区分", "学年区分"]), grade]));
  return mapMasterStudentCourseEnrollmentsForProfile(enrollments, studentsById, lineupsByKey, schools, headquarters, grades, studentId);
}

export async function readMasterStudentCourseEnrollmentsForProfileAsync(studentId?: string) {
  const [enrollmentRecords, studentRecords, lineupRecords, schoolRecords, headquarterRecords, gradeRecords] = await Promise.all([
    readMasterRecordsAsync("studentCourseEnrollments"),
    readMasterRecordsAsync("students"),
    readMasterRecordsAsync("courseLineups"),
    readMasterRecordsAsync("schools"),
    readMasterRecordsAsync("headquarters"),
    readMasterRecordsAsync("gradeMasters"),
  ]);
  const enrollments = activeRecords(enrollmentRecords);
  if (enrollments.length === 0) return null;

  const studentsById = new Map(activeRecords(studentRecords).map((student) => [student["生徒ＩＤ"], student]));
  const lineupsByKey = new Map(
    activeRecords(lineupRecords).map((lineup) => [compositeKey(lineup, ["年度", "授業区分", "講座種類", "講座コース"]), lineup]),
  );
  const schools = new Map(activeRecords(schoolRecords).map((school) => [school["校舎コード"], school]));
  const headquarters = new Map(activeRecords(headquarterRecords).map((headquarter) => [headquarter["本部コード"], headquarter]));
  const grades = new Map(activeRecords(gradeRecords).map((grade) => [compositeKey(grade, ["学校区分", "学年区分"]), grade]));
  return mapMasterStudentCourseEnrollmentsForProfile(enrollments, studentsById, lineupsByKey, schools, headquarters, grades, studentId);
}

function mapMasterStudentCourseEnrollmentsForProfile(
  enrollments: MasterRecord[],
  studentsById: Map<string, MasterRecord>,
  lineupsByKey: Map<string, MasterRecord>,
  schools: Map<string, MasterRecord>,
  headquarters: Map<string, MasterRecord>,
  grades: Map<string, MasterRecord>,
  studentId?: string,
) {
  return enrollments
    .filter((enrollment) => !studentId || enrollment["生徒ＩＤ"] === studentId)
    .map((enrollment) => {
      const student = studentsById.get(enrollment["生徒ＩＤ"]);
      const lineupKey = [enrollment["年度"], enrollment["授業区分"], enrollment["講座種類"], enrollment["講座コース区分"]].join("\u001f");
      const lineup = lineupsByKey.get(lineupKey);
      const school = student ? schools.get(student["高等部校舎コード"]) : undefined;
      const grade = student ? grades.get(compositeKey(student, ["学校区分", "学年区分"])) : undefined;
      return {
        studentId: enrollment["生徒ＩＤ"],
        nickname: student ? displayName(student) || enrollment["生徒ＩＤ"] : enrollment["生徒ＩＤ"],
        group: school ? (headquarters.get(school["本部コード"])?.["本部名称"] ?? school["本部コード"] ?? "") : "",
        campus: school?.["校舎名称"] ?? student?.["高等部校舎コード"] ?? "",
        grade: normalizeGradeLabel(grade?.["学年"]),
        goalUniversity: student?.["大学名"] ?? "",
        goalFaculty: student?.["学部名"] ?? "",
        goalDepartment: student?.["学科名"] ?? "",
        courseCode: enrollment["講座コース区分"],
        courseName: courseNameFromLineup(lineup, enrollment["講座コース区分"]),
        courseCategory: normalizedCourseCategory(enrollment["講座コース区分"]),
        year: enrollment["年度"],
        note: "マスター取込データ",
      };
    });
}
