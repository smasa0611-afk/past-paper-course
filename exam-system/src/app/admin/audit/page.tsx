"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, FileText, Upload } from "lucide-react";

type ImportIssue = {
  line: number;
  column?: string;
  message: string;
  level: "error" | "warning";
};

type ImportLog = {
  id: string;
  batchId?: string;
  masterLabel: string;
  fileName: string;
  importedAt: string;
  importedBy: string;
  totalRows: number;
  addCount: number;
  updateCount: number;
  disabledCount?: number;
  skipCount?: number;
  errorCount: number;
  warningCount: number;
  status: string;
  issues: ImportIssue[];
};

function dateText(value: string) {
  return new Date(value).toLocaleString("ja-JP");
}

function statusText(status: string) {
  if (status === "success") return "成功";
  if (status === "failed") return "失敗";
  if (status === "validated") return "検証済み";
  return status;
}

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/master-data/import-logs")
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "取込ログの読み込みに失敗しました。");
        setLogs(data.logs ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "取込ログの読み込みに失敗しました。"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 md:px-6">
      <section className="mx-auto max-w-[1500px]">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-blue-600">IMPORT AUDIT</p>
            <h1 className="text-2xl font-black">取込ログ</h1>
            <p className="mt-2 text-sm text-slate-600">CSV取込の実行結果、追加・更新・無効化件数、失敗レコードを確認します。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/import" className="inline-flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-bold text-white">
              <Upload className="h-4 w-4" />
              CSV一括取込
            </Link>
            <Link href="/settings/master" className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700">
              マスター管理へ
            </Link>
          </div>
        </div>

        {loading && <div className="rounded border border-slate-200 bg-white p-6 text-sm font-bold text-slate-500 shadow-sm">読み込み中...</div>}

        {error && (
          <div className="rounded border border-rose-200 bg-white p-6 shadow-sm">
            <AlertTriangle className="h-8 w-8 text-rose-600" />
            <h2 className="mt-3 font-bold">取込ログを開けません</h2>
            <p className="mt-2 text-sm text-slate-600">{error === "Forbidden" ? "管理者のみ利用できます。" : error}</p>
          </div>
        )}

        {!loading && !error && (
          <section className="rounded border border-slate-200 bg-white shadow-sm">
            <div className="overflow-auto">
              <table className="min-w-[1300px] border-collapse text-sm">
                <thead className="bg-slate-900 text-white">
                  <tr>
                    {["取込日時", "実行ユーザー", "対象ファイル", "対象マスター", "結果サマリー", "追加", "更新", "無効化", "スキップ", "エラー", "失敗レコード"].map((header) => (
                      <th key={header} className="whitespace-nowrap border-r border-slate-700 px-3 py-2 text-left">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const failedIssues = log.issues.filter((issue) => issue.level === "error" || issue.message.startsWith("スキップ:"));
                    return (
                      <tr key={log.id} className="border-b border-slate-100">
                        <td className="whitespace-nowrap px-3 py-2">{dateText(log.importedAt)}</td>
                        <td className="px-3 py-2">{log.importedBy}</td>
                        <td className="px-3 py-2">{log.fileName}</td>
                        <td className="px-3 py-2 font-bold">{log.masterLabel}</td>
                        <td className="px-3 py-2">
                          <span className={`rounded px-2 py-1 text-xs font-bold ${log.status === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                            {statusText(log.status)}
                          </span>
                          <span className="ml-2 text-xs text-slate-500">総行数 {log.totalRows.toLocaleString()}</span>
                        </td>
                        <td className="px-3 py-2">{log.addCount.toLocaleString()}</td>
                        <td className="px-3 py-2">{log.updateCount.toLocaleString()}</td>
                        <td className="px-3 py-2">{Number(log.disabledCount ?? 0).toLocaleString()}</td>
                        <td className="px-3 py-2">{Number(log.skipCount ?? 0).toLocaleString()}</td>
                        <td className={`px-3 py-2 font-bold ${log.errorCount > 0 ? "text-rose-600" : "text-slate-700"}`}>{log.errorCount}</td>
                        <td className="px-3 py-2">
                          {failedIssues.length > 0 ? (
                            <div className="max-w-xl space-y-1">
                              {failedIssues.slice(0, 3).map((issue, index) => (
                                <div key={`${issue.line}-${index}`} className="text-xs text-rose-700">
                                  行{issue.line}: {issue.message}
                                </div>
                              ))}
                              {failedIssues.length > 3 && <div className="text-xs text-slate-500">ほか {failedIssues.length - 3} 件</div>}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500">なし</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={11} className="px-3 py-12 text-center text-slate-500">
                        <FileText className="mx-auto mb-2 h-5 w-5" />
                        取込ログがありません。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </section>
    </div>
  );
}
