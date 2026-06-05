"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, FileUp, History, Upload, XCircle } from "lucide-react";

type BulkSummary = {
  previewId: string;
  masterKey: string;
  masterLabel: string;
  fileName: string;
  expectedFileName: string;
  canCommit: boolean;
  summary: {
    totalRows: number;
    addCount: number;
    updateCount: number;
    disabledCount: number;
    skipCount: number;
    errorCount: number;
    warningCount: number;
  };
};

type DiffRow = {
  masterKey: string;
  masterLabel: string;
  primaryKey: string;
  changeType: "追加" | "更新" | "無効化候補" | "スキップ" | "エラー";
  before: Record<string, string> | null;
  after: Record<string, string> | null;
  reason?: string;
};

type BulkPreview = {
  batchId: string;
  unknownFiles: string[];
  missingFiles: string[];
  summaries: BulkSummary[];
  diffRows: DiffRow[];
  canCommit: boolean;
};

type CommitResult = {
  fileNames: string[];
  addCount: number;
  updateCount: number;
  disabledCount: number;
  skipCount: number;
};

type StorageStatus = {
  ready: boolean;
  provider: string;
  message: string;
};

const expectedFiles = [
  "BRAND.csv",
  "HONBU.csv",
  "KOUSHA.csv",
  "GAKUNEN.csv",
  "DAIGAKU.csv",
  "LINEUP.csv",
  "SEITO.csv",
  "SHAIN.csv",
  "KANRIHONBU.csv",
  "KANRIKOUSHA.csv",
  "JUKOUKANRI.csv",
];

function compactRecord(record: Record<string, string> | null) {
  if (!record) return "-";
  return Object.entries(record)
    .filter(([key]) => key !== "is_active")
    .slice(0, 6)
    .map(([key, value]) => `${key}: ${value || "-"}`)
    .join(" / ");
}

function summaryRowClass(item: BulkSummary) {
  if (item.summary.errorCount > 0) return "border-b border-rose-200 bg-rose-50";
  if (item.summary.skipCount > 0 || item.summary.disabledCount > 0) return "border-b border-amber-200 bg-amber-50";
  return "border-b border-slate-100";
}

function countClass(value: number, tone: "danger" | "warning" | "normal" = "normal") {
  if (value <= 0) return "px-3 py-2 text-slate-500";
  if (tone === "danger") return "px-3 py-2 font-black text-rose-700";
  if (tone === "warning") return "px-3 py-2 font-black text-amber-800";
  return "px-3 py-2 font-bold text-slate-900";
}

function diffRowClass(row: DiffRow, index: number) {
  if (row.changeType === "エラー") return "bg-rose-50";
  if (row.changeType === "スキップ") return "bg-amber-50";
  if (row.changeType === "無効化候補") return "bg-orange-50";
  return index % 2 === 0 ? "bg-white" : "bg-slate-50";
}

function changeTypeClass(changeType: DiffRow["changeType"]) {
  if (changeType === "エラー") return "border border-rose-200 bg-rose-100 text-rose-700";
  if (changeType === "スキップ") return "border border-amber-200 bg-amber-100 text-amber-800";
  if (changeType === "無効化候補") return "border border-orange-200 bg-orange-100 text-orange-800";
  if (changeType === "追加") return "border border-emerald-200 bg-emerald-100 text-emerald-700";
  return "border border-slate-200 bg-slate-100 text-slate-700";
}

export default function AdminBulkImportPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [preview, setPreview] = useState<BulkPreview | null>(null);
  const [selectedPreviewIds, setSelectedPreviewIds] = useState<Set<string>>(new Set());
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const filesByName = useMemo(() => new Map(files.map((file) => [file.name.toUpperCase(), file])), [files]);
  const committableIds = useMemo(() => new Set(preview?.summaries.filter((summary) => summary.canCommit).map((summary) => summary.previewId) ?? []), [preview]);

  useEffect(() => {
    let active = true;
    fetch("/api/master-data/storage-status")
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!active || !data) return;
        setStorageStatus({ ready: Boolean(data.ready), provider: String(data.provider ?? "unknown"), message: String(data.message ?? "") });
      })
      .catch(() => {
        if (active) setStorageStatus({ ready: false, provider: "unknown", message: "保存先の確認に失敗しました。" });
      });
    return () => {
      active = false;
    };
  }, []);

  const addFiles = (incoming: FileList | File[]) => {
    const next = new Map(files.map((file) => [file.name.toUpperCase(), file]));
    Array.from(incoming).forEach((file) => next.set(file.name.toUpperCase(), file));
    setFiles(Array.from(next.values()));
    setPreview(null);
    setSelectedPreviewIds(new Set());
    setCommitResult(null);
    setMessage("");
    setError("");
  };

  const runPreview = async () => {
    if (files.length === 0) {
      setError("CSVファイルを選択してください。");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    setCommitResult(null);
    try {
      const form = new FormData();
      files.forEach((file) => form.append("files", file));
      const res = await fetch("/api/master-data/bulk-import", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "取込前チェックに失敗しました。");
      setPreview(data);
      const initialIds = new Set<string>((data.summaries ?? []).filter((summary: BulkSummary) => summary.canCommit).map((summary: BulkSummary) => summary.previewId));
      setSelectedPreviewIds(initialIds);
      setMessage("取込前チェックが完了しました。差分とエラー内容を確認してください。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "取込前チェックに失敗しました。");
    } finally {
      setBusy(false);
    }
  };

  const commitSelected = async (all: boolean) => {
    if (!preview) return;
    const previewIds = all ? preview.summaries.map((summary) => summary.previewId) : Array.from(selectedPreviewIds);
    if (previewIds.length === 0) {
      setError("確定対象を選択してください。");
      return;
    }
    if (previewIds.some((id) => !committableIds.has(id))) {
      setError("エラーがあるファイルは取込確定できません。");
      return;
    }
    if (!window.confirm(all ? "エラーのない全ファイルを指定順で確定します。よろしいですか？" : "選択したファイルのみ確定します。よろしいですか？")) return;

    setBusy(true);
    setError("");
    setMessage("");
    setCommitResult(null);
    try {
      const res = await fetch("/api/master-data/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ previewIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "取込確定に失敗しました。");
      setMessage(`取込を確定しました。ログ件数: ${Number(data.results?.length ?? 0).toLocaleString()}件`);
      const selectedSummaries = preview.summaries.filter((summary) => previewIds.includes(summary.previewId));
      const result = selectedSummaries.reduce<CommitResult>(
        (acc, item) => ({
          fileNames: [...acc.fileNames, item.fileName],
          addCount: acc.addCount + item.summary.addCount,
          updateCount: acc.updateCount + item.summary.updateCount,
          disabledCount: acc.disabledCount + item.summary.disabledCount,
          skipCount: acc.skipCount + item.summary.skipCount,
        }),
        { fileNames: [], addCount: 0, updateCount: 0, disabledCount: 0, skipCount: 0 },
      );
      const doneMessage = `取込を確定しました。対象: ${result.fileNames.join(", ")} / 追加 ${result.addCount.toLocaleString()}件 / 更新 ${result.updateCount.toLocaleString()}件 / 無効化 ${result.disabledCount.toLocaleString()}件 / スキップ ${result.skipCount.toLocaleString()}件`;
      setCommitResult(result);
      setMessage(doneMessage);
      window.alert(doneMessage);
      setPreview(null);
      setFiles([]);
      setSelectedPreviewIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "取込確定に失敗しました。");
    } finally {
      setBusy(false);
    }
  };

  const toggleSelected = (previewId: string) => {
    setSelectedPreviewIds((current) => {
      const next = new Set(current);
      if (next.has(previewId)) next.delete(previewId);
      else next.add(previewId);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 md:px-6">
      <section className="mx-auto max-w-[1500px]">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-blue-600">BULK MASTER IMPORT</p>
            <h1 className="text-2xl font-black">CSV一括取込</h1>
            <p className="mt-2 text-sm text-slate-600">基幹システムCSV 11ファイルをまとめて検証し、指定順でマスターへ反映します。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/settings/master" className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700">
              マスター管理へ
            </Link>
            <Link href="/admin/audit" className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700">
              <History className="h-4 w-4" />
              取込ログ
            </Link>
          </div>
        </div>

        <section
          onDrop={(event) => {
            event.preventDefault();
            addFiles(event.dataTransfer.files);
          }}
          onDragOver={(event) => event.preventDefault()}
          className="mb-5 rounded border border-dashed border-blue-300 bg-white p-5 shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded bg-blue-50 p-3 text-blue-600">
                <FileUp className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-bold">ドラッグ&ドロップでまとめてアップロード</h2>
                <p className="mt-1 text-sm text-slate-600">Shift-JIS / CP932、BOM付きUTF-8、CRLF、ダブルクォート囲みに対応します。</p>
              </div>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-bold text-white">
              <Upload className="h-4 w-4" />
              個別アップロード
              <input type="file" accept=".csv,text/csv" multiple className="hidden" onChange={(event) => event.target.files && addFiles(event.target.files)} />
            </label>
          </div>
        </section>

        <section className="mb-5 rounded border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold">対象ファイル</h2>
            <button type="button" onClick={runPreview} disabled={busy || files.length === 0} className="rounded bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
              取込前チェック
            </button>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            {expectedFiles.map((fileName) => {
              const uploaded = filesByName.get(fileName.toUpperCase());
              return (
                <div key={fileName} className={`rounded border px-3 py-2 text-sm ${uploaded ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold">{fileName}</span>
                    {uploaded ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-slate-300" />}
                  </div>
                  <div className="mt-1 truncate text-xs text-slate-500">{uploaded?.name ?? "未選択"}</div>
                </div>
              );
            })}
          </div>
          {storageStatus && (
            <div className={`mt-3 rounded border px-3 py-2 text-sm font-bold ${storageStatus.ready ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
              保存先: {storageStatus.provider} / {storageStatus.message}
            </div>
          )}
          {message && <div className="mt-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">{message}</div>}
          {error && <div className="mt-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{error}</div>}
          {commitResult && (
            <div className="mt-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
              <div className="font-bold">確定済み: {commitResult.fileNames.join(", ")}</div>
              <div className="mt-1">
                追加 {commitResult.addCount.toLocaleString()}件 / 更新 {commitResult.updateCount.toLocaleString()}件 / 無効化 {commitResult.disabledCount.toLocaleString()}件 / スキップ {commitResult.skipCount.toLocaleString()}件
              </div>
            </div>
          )}
        </section>

        {preview && (
          <>
            {(preview.unknownFiles.length > 0 || preview.missingFiles.length > 0) && (
              <div className="mb-5 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <div className="flex items-center gap-2 font-bold">
                  <AlertTriangle className="h-4 w-4" />
                  ファイル確認
                </div>
                {preview.unknownFiles.length > 0 && <p className="mt-1">対象外ファイル: {preview.unknownFiles.join(", ")}</p>}
                {preview.missingFiles.length > 0 && <p className="mt-1">未アップロード: {preview.missingFiles.join(", ")}</p>}
              </div>
            )}

            <section className="mb-5 rounded border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
                <h2 className="font-bold">差分プレビュー</h2>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => commitSelected(false)} disabled={busy || selectedPreviewIds.size === 0} className="rounded bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                    一部のみ確定
                  </button>
                  <button type="button" onClick={() => commitSelected(true)} disabled={busy || !preview.canCommit} className="rounded bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                    全件確定
                  </button>
                </div>
              </div>
              <div className="overflow-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead className="bg-slate-900 text-white">
                    <tr>
                      {["確定", "対象マスター", "対象ファイル", "追加", "更新", "無効化候補", "スキップ", "エラー", "警告"].map((header) => (
                        <th key={header} className="whitespace-nowrap border-r border-slate-700 px-3 py-2 text-left">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.summaries.map((item) => (
                      <tr key={item.previewId} className={summaryRowClass(item)}>
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={selectedPreviewIds.has(item.previewId)} disabled={!item.canCommit} onChange={() => toggleSelected(item.previewId)} />
                        </td>
                        <td className="px-3 py-2 font-bold">
                          <div>{item.masterLabel}</div>
                          {item.summary.errorCount > 0 && <div className="mt-1 text-[11px] font-black text-rose-700">要修正: 不整合あり</div>}
                          {item.summary.errorCount === 0 && (item.summary.skipCount > 0 || item.summary.disabledCount > 0) && (
                            <div className="mt-1 text-[11px] font-black text-amber-800">要確認: スキップ/無効化候補あり</div>
                          )}
                        </td>
                        <td className="px-3 py-2">{item.fileName}</td>
                        <td className="px-3 py-2">{item.summary.addCount.toLocaleString()}</td>
                        <td className="px-3 py-2">{item.summary.updateCount.toLocaleString()}</td>
                        <td className={countClass(item.summary.disabledCount, "warning")}>{item.summary.disabledCount.toLocaleString()}</td>
                        <td className={countClass(item.summary.skipCount, item.summary.errorCount > 0 ? "danger" : "warning")}>{item.summary.skipCount.toLocaleString()}</td>
                        <td className={countClass(item.summary.errorCount, "danger")}>{item.summary.errorCount.toLocaleString()}</td>
                        <td className={countClass(item.summary.warningCount, "warning")}>{item.summary.warningCount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 p-4">
                <h2 className="font-bold">差分明細</h2>
                <p className="mt-1 text-xs font-semibold text-slate-500">不整合レコード（エラー・スキップ）を先頭に表示します。</p>
              </div>
              <div className="max-h-[560px] overflow-auto">
                <table className="min-w-[1200px] border-collapse text-xs">
                  <thead className="sticky top-0 bg-slate-900 text-white">
                    <tr>
                      {["対象マスター", "主キー", "変更種別", "変更前", "変更後", "エラー理由"].map((header) => (
                        <th key={header} className="whitespace-nowrap border-r border-slate-700 px-3 py-2 text-left">{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.diffRows.map((row, index) => (
                      <tr key={`${row.masterKey}-${row.primaryKey}-${index}`} className={diffRowClass(row, index)}>
                        <td className="border-r border-b border-slate-200 px-3 py-2 font-bold">{row.masterLabel}</td>
                        <td className="border-r border-b border-slate-200 px-3 py-2">{row.primaryKey}</td>
                        <td className="border-r border-b border-slate-200 px-3 py-2">
                          <span className={`inline-flex rounded px-2 py-1 text-[11px] font-black ${changeTypeClass(row.changeType)}`}>{row.changeType}</span>
                        </td>
                        <td className="border-r border-b border-slate-200 px-3 py-2">{compactRecord(row.before)}</td>
                        <td className="border-r border-b border-slate-200 px-3 py-2">{compactRecord(row.after)}</td>
                        <td className={`border-b border-slate-200 px-3 py-2 font-semibold ${row.changeType === "エラー" ? "text-rose-700" : row.changeType === "スキップ" ? "text-amber-800" : "text-slate-600"}`}>{row.reason ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </section>
    </div>
  );
}
