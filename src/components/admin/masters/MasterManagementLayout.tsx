"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileClock,
  History,
  Search,
  Upload,
  XCircle,
} from "lucide-react";

type MasterSummary = {
  key: string;
  label: string;
  description: string;
  fileName: string;
  primaryKey: string[];
  previewColumns: string[];
  requiredHeaders: string[];
  rowCount: number;
  lastImportedAt: string | null;
  importedCount: number;
  errorCount: number;
};

type MasterRecord = Record<string, string>;

type ImportIssue = {
  line: number;
  column?: string;
  message: string;
  level: "error" | "warning";
};

type ImportPreview = {
  previewId: string;
  summary: {
    totalRows: number;
    addCount: number;
    updateCount: number;
    skipCount: number;
    errorCount: number;
    warningCount: number;
  };
  issues: ImportIssue[];
  previewRows: MasterRecord[];
  canCommit: boolean;
};

const defaultMasterKey = "universities";
const futureMasterLabels = [
  "課題・締切マスター",
  "演習スコアマスター",
  "映像授業視聴履歴",
  "過去問PDFマスター",
  "過去問提供大学マスター",
  "弱点別補強ルートマスター",
];

function dateText(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ja-JP");
}

function valueText(value: string | undefined) {
  return value && value.trim() ? value : "-";
}

function importStatus(summary: MasterSummary) {
  if (summary.errorCount > 0) return "要確認";
  if (summary.lastImportedAt) return "正常";
  return "未取込";
}

export default function MasterManagementLayout({ initialMasterKey }: { initialMasterKey?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [masters, setMasters] = useState<MasterSummary[]>([]);
  const [summary, setSummary] = useState<MasterSummary | null>(null);
  const [records, setRecords] = useState<MasterRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [query, setQuery] = useState("");
  const [committedQuery, setCommittedQuery] = useState("");
  const [menuQuery, setMenuQuery] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loadingSummaries, setLoadingSummaries] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [importing, setImporting] = useState(false);

  const selectedMasterKey = searchParams.get("type") || initialMasterKey || defaultMasterKey;
  const columns = useMemo(() => summary?.previewColumns ?? [], [summary]);
  const selectedExists = masters.some((master) => master.key === selectedMasterKey);
  const effectiveMasterKey = selectedExists || masters.length === 0 ? selectedMasterKey : defaultMasterKey;

  const filteredMasters = useMemo(() => {
    const normalized = menuQuery.trim().toLowerCase();
    if (!normalized) return masters;
    return masters.filter((master) => {
      const target = `${master.label} ${master.fileName} ${master.description}`.toLowerCase();
      return target.includes(normalized);
    });
  }, [masters, menuQuery]);

  const loadSummaries = useCallback(async () => {
    setLoadingSummaries(true);
    setError("");
    try {
      const res = await fetch("/api/master-data");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "マスター一覧の読み込みに失敗しました。");
      setMasters(data.masters ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "マスター一覧の読み込みに失敗しました。");
    } finally {
      setLoadingSummaries(false);
    }
  }, []);

  const loadRecords = useCallback(async () => {
    if (!effectiveMasterKey) return;
    setLoadingRecords(true);
    setError("");
    try {
      const url = new URL(`/api/master-data/${effectiveMasterKey}`, window.location.origin);
      url.searchParams.set("page", String(page));
      url.searchParams.set("pageSize", String(pageSize));
      if (committedQuery) url.searchParams.set("q", committedQuery);
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "マスターデータの読み込みに失敗しました。");
      setSummary(data.summary);
      setRecords(data.records ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "マスターデータの読み込みに失敗しました。");
      setSummary(null);
      setRecords([]);
    } finally {
      setLoadingRecords(false);
    }
  }, [committedQuery, effectiveMasterKey, page, pageSize]);

  useEffect(() => {
    loadSummaries();
  }, [loadSummaries]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    setPage(1);
    setQuery("");
    setCommittedQuery("");
    setPreview(null);
    setFile(null);
    setMessage("");
  }, [effectiveMasterKey]);

  useEffect(() => {
    if (masters.length > 0 && !selectedExists && pathname === "/settings/master") {
      router.replace(`/settings/master?type=${defaultMasterKey}`);
    }
  }, [masters.length, pathname, router, selectedExists]);

  const selectMaster = (key: string) => {
    router.push(`/settings/master?type=${key}`);
  };

  const submitPreview = async () => {
    if (!file) {
      setError("CSVファイルを選択してください。");
      return;
    }
    setImporting(true);
    setMessage("");
    setError("");
    setPreview(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/master-data/${effectiveMasterKey}/import`, { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "CSV検証に失敗しました。");
      setPreview(data);
      setMessage("CSVを検証しました。内容を確認してから取込確定してください。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "CSV検証に失敗しました。");
    } finally {
      setImporting(false);
    }
  };

  const commitPreview = async () => {
    if (!preview) return;
    if (!window.confirm("このCSVをマスターへ取り込みます。既存の同一主キーは上書き更新されます。よろしいですか？")) return;

    setImporting(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch(`/api/master-data/${effectiveMasterKey}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ previewId: preview.previewId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "CSV取込に失敗しました。");
      setPreview(null);
      setFile(null);
      setMessage(`取込を確定しました。現在の登録件数: ${Number(data.totalCount ?? 0).toLocaleString()}件`);
      await Promise.all([loadRecords(), loadSummaries()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "CSV取込に失敗しました。");
    } finally {
      setImporting(false);
    }
  };

  const runSearch = () => {
    setPage(1);
    setCommittedQuery(query.trim());
  };

  if (loadingSummaries) {
    return <div className="min-h-screen bg-slate-50 px-6 py-10 text-slate-700">読み込み中...</div>;
  }

  if (error && masters.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 px-6 py-10">
        <section className="mx-auto max-w-3xl rounded border border-rose-200 bg-white p-6 shadow-sm">
          <AlertTriangle className="h-8 w-8 text-rose-600" />
          <h1 className="mt-4 text-2xl font-bold text-slate-900">マスター管理を開けません</h1>
          <p className="mt-2 text-sm text-slate-600">{error === "Forbidden" ? "設定画面はシステム管理者のみ利用できます。" : error}</p>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-4 text-slate-900 md:px-6">
      <div className="mx-auto flex max-w-[1760px] gap-4">
        <aside className="hidden w-[290px] shrink-0 lg:block">
          <div className="sticky top-[86px] max-h-[calc(100vh-104px)] overflow-y-auto rounded border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 p-4">
              <p className="text-xs font-bold tracking-[0.18em] text-blue-600">MASTER LIST</p>
              <h2 className="mt-1 text-lg font-black">マスター一覧</h2>
              <label className="relative mt-3 block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={menuQuery}
                  onChange={(event) => setMenuQuery(event.target.value)}
                  placeholder="大学・社員・生徒"
                  className="w-full rounded border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm"
                />
              </label>
            </div>

            <nav className="space-y-1 p-2">
              {filteredMasters.map((master) => {
                const active = master.key === effectiveMasterKey;
                return (
                  <button
                    key={master.key}
                    type="button"
                    onClick={() => selectMaster(master.key)}
                    className={`w-full border-l-4 px-3 py-3 text-left transition ${
                      active
                        ? "border-blue-600 bg-blue-50 text-blue-950"
                        : "border-transparent text-slate-700 hover:border-blue-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-bold">{master.label}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          master.errorCount > 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {importStatus(master)}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {master.rowCount.toLocaleString()}件 / エラー{master.errorCount.toLocaleString()}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-400">最終取込: {dateText(master.lastImportedAt)}</div>
                  </button>
                );
              })}
              {filteredMasters.length === 0 && <p className="px-3 py-6 text-sm text-slate-500">該当するマスターがありません。</p>}
            </nav>

            <div className="border-t border-slate-200 p-3">
              <div className="mb-2 text-xs font-bold text-slate-500">追加予定</div>
              <div className="space-y-1">
                {futureMasterLabels.map((label) => (
                  <div key={label} className="rounded bg-slate-50 px-3 py-2 text-xs text-slate-500">
                    {label}
                  </div>
                ))}
              </div>
              <div className="mt-3 grid gap-2">
                <Link href="/admin/import" className="inline-flex items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-bold text-white">
                  <Upload className="h-4 w-4" />
                  CSV一括取込
                </Link>
                <Link href="/admin/audit" className="inline-flex items-center justify-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700">
                  <History className="h-4 w-4" />
                  取込ログ
                </Link>
              </div>
            </div>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold tracking-[0.18em] text-blue-600">MASTER DATA</p>
              <h1 className="text-2xl font-black">{summary?.label ?? "マスター管理"}</h1>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">{summary?.description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/settings" className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700">
                設定トップへ
              </Link>
              <a
                href={`/api/master-data/${effectiveMasterKey}?format=csv`}
                className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700"
              >
                <Download className="h-4 w-4" />
                CSVエクスポート
              </a>
            </div>
          </div>

          <div className="mb-4 lg:hidden">
            <label className="mb-2 block text-xs font-bold text-slate-500">マスター切替</label>
            <select
              value={effectiveMasterKey}
              onChange={(event) => selectMaster(event.target.value)}
              className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm font-bold"
            >
              {masters.map((master) => (
                <option key={master.key} value={master.key}>
                  {master.label}
                </option>
              ))}
            </select>
          </div>

          {summary && (
            <div className="mb-4 grid gap-3 md:grid-cols-4">
              <div className="rounded border border-slate-200 bg-white p-3 shadow-sm">
                <div className="text-xs font-bold text-slate-500">登録件数</div>
                <div className="mt-1 text-xl font-black">{summary.rowCount.toLocaleString()}</div>
              </div>
              <div className="rounded border border-slate-200 bg-white p-3 shadow-sm">
                <div className="text-xs font-bold text-slate-500">最終取込日時</div>
                <div className="mt-1 text-sm font-bold">{dateText(summary.lastImportedAt)}</div>
              </div>
              <div className="rounded border border-slate-200 bg-white p-3 shadow-sm">
                <div className="text-xs font-bold text-slate-500">直近取込件数</div>
                <div className="mt-1 text-xl font-black">{summary.importedCount.toLocaleString()}</div>
              </div>
              <div className="rounded border border-slate-200 bg-white p-3 shadow-sm">
                <div className="text-xs font-bold text-slate-500">直近エラー件数</div>
                <div className={`mt-1 text-xl font-black ${summary.errorCount > 0 ? "text-rose-600" : "text-slate-900"}`}>{summary.errorCount}</div>
              </div>
            </div>
          )}

          <section className="mb-4 rounded border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Upload className="h-5 w-5 text-blue-600" />
              <h2 className="font-bold">CSVインポート</h2>
            </div>
            <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              <button type="button" onClick={submitPreview} disabled={importing} className="rounded bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                取込前チェック
              </button>
              <button type="button" onClick={commitPreview} disabled={importing || !preview?.canCommit} className="rounded bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                取込確定
              </button>
            </div>
            {summary && (
              <p className="mt-2 text-xs leading-5 text-slate-500">
                想定ファイル: {summary.fileName} / 必須ヘッダー: {summary.requiredHeaders.join(", ")} / 主キー: {summary.primaryKey.join(" + ")}
              </p>
            )}
            {message && <div className="mt-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">{message}</div>}
            {error && <div className="mt-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{error}</div>}

            {preview && (
              <div className="mt-4 grid gap-4 xl:grid-cols-[320px_1fr]">
                <div className="rounded border border-slate-200 bg-slate-50 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    {preview.canCommit ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <XCircle className="h-5 w-5 text-rose-600" />}
                    <h3 className="font-bold">検証結果</h3>
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <dt className="text-slate-500">総行数</dt><dd className="font-bold">{preview.summary.totalRows}</dd>
                    <dt className="text-slate-500">追加</dt><dd className="font-bold">{preview.summary.addCount}</dd>
                    <dt className="text-slate-500">更新</dt><dd className="font-bold">{preview.summary.updateCount}</dd>
                    <dt className="text-slate-500">スキップ</dt><dd className="font-bold">{preview.summary.skipCount}</dd>
                    <dt className="text-slate-500">警告</dt><dd className="font-bold">{preview.summary.warningCount}</dd>
                    <dt className="text-slate-500">エラー</dt><dd className="font-bold">{preview.summary.errorCount}</dd>
                  </dl>
                </div>
                <div className="max-h-72 overflow-auto rounded border border-slate-200">
                  <table className="min-w-full border-collapse text-xs">
                    <thead className="sticky top-0 bg-slate-900 text-white">
                      <tr>
                        {["行", "種別", "項目", "内容"].map((header) => (
                          <th key={header} className="px-2 py-2 text-left">{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.issues.map((issue, index) => (
                        <tr key={`${issue.line}-${issue.column}-${index}`} className="border-b border-slate-100 bg-white">
                          <td className="px-2 py-2">{issue.line}</td>
                          <td className={`px-2 py-2 font-bold ${issue.level === "error" ? "text-rose-600" : "text-amber-600"}`}>{issue.level === "error" ? "エラー" : "警告"}</td>
                          <td className="px-2 py-2">{issue.column ?? "-"}</td>
                          <td className="px-2 py-2">{issue.message}</td>
                        </tr>
                      ))}
                      {preview.issues.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-3 py-8 text-center text-slate-500">エラー・警告はありません。</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          <section className="rounded border border-slate-200 bg-white shadow-sm">
            <div className="grid gap-3 border-b border-slate-200 p-4 lg:grid-cols-[1fr_auto_auto]">
              <label className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") runSearch();
                  }}
                  placeholder="コード・名称・氏名などで検索"
                  className="w-full rounded border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm"
                />
              </label>
              <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} className="rounded border border-slate-300 bg-white px-3 py-2 text-sm">
                {[25, 50, 100, 200].map((size) => <option key={size} value={size}>{size}件</option>)}
              </select>
              <button type="button" onClick={runSearch} className="rounded bg-slate-900 px-4 py-2 text-sm font-bold text-white">検索</button>
            </div>

            <div className="overflow-auto">
              {loadingRecords ? (
                <div className="flex items-center justify-center gap-2 px-3 py-16 text-sm font-bold text-slate-500">
                  <FileClock className="h-5 w-5" />
                  読み込み中...
                </div>
              ) : (
                <table className="min-w-full border-collapse text-sm">
                  <thead className="sticky top-0 bg-slate-900 text-white">
                    <tr>
                      {columns.map((column) => (
                        <th key={column} className="whitespace-nowrap border-r border-slate-700 px-3 py-2 text-left">{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record, index) => (
                      <tr key={`${index}-${columns.map((column) => record[column]).join("-")}`} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                        {columns.map((column) => (
                          <td key={column} className="max-w-80 whitespace-nowrap border-r border-b border-slate-200 px-3 py-2">
                            {valueText(record[column])}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {records.length === 0 && (
                      <tr>
                        <td colSpan={columns.length || 1} className="px-3 py-10 text-center text-slate-500">データがありません。</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 p-4 text-sm">
              <div className="font-bold text-slate-600">
                {total.toLocaleString()}件中 {records.length.toLocaleString()}件表示 / {page} / {totalPages}ページ
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1} className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-3 py-1.5 font-bold disabled:opacity-40">
                  <ChevronLeft className="h-4 w-4" />
                  前へ
                </button>
                <button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page >= totalPages} className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-3 py-1.5 font-bold disabled:opacity-40">
                  次へ
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </section>
        </section>
      </div>
    </div>
  );
}
