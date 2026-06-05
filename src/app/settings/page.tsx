"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, ClipboardList, Database, ExternalLink, Lock, Settings, Upload } from "lucide-react";

type User = {
  id: string;
  name: string;
  role: "student" | "teacher";
  isSystemAdmin?: boolean;
};

type ImportFailure = {
  rowIndex: number;
  studentId: string;
  reason: string;
  examLabel?: string;
};

type ImportSuccess = {
  rowIndex: number;
  studentId: string;
  examId: string;
  examTitle: string;
  score: number;
  maxScore: number;
  submissionId: string;
  submittedAt?: string;
  gradedAt?: string;
  importedAt?: string;
};

type ImportSkipped = {
  rowIndex: number;
  studentId: string;
  examId: string;
  examTitle: string;
  score: number;
  reason: string;
};

type ImportResult = {
  imported: number;
  skipped: number;
  failed: number;
  createdAssignments: number;
  failures: ImportFailure[];
  importedRecords: ImportSuccess[];
  skippedRecords: ImportSkipped[];
};

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [scoreCsvFile, setScoreCsvFile] = useState<File | null>(null);
  const [scoreCsvMessage, setScoreCsvMessage] = useState("");
  const [scoreCsvError, setScoreCsvError] = useState("");
  const [scoreCsvImporting, setScoreCsvImporting] = useState(false);
  const [scoreCsvResult, setScoreCsvResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const importScoreCsv = async () => {
    setScoreCsvMessage("");
    setScoreCsvError("");
    setScoreCsvResult(null);
    if (!scoreCsvFile) {
      setScoreCsvError("CSVファイルを選択してください。");
      return;
    }

    setScoreCsvImporting(true);
    try {
      const form = new FormData();
      form.append("file", scoreCsvFile);
      const res = await fetch("/api/import-secondary-scores", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const details = Array.isArray(data.details) ? `\n${data.details.join("\n")}` : "";
        setScoreCsvError(`${data.error || "CSV取り込みに失敗しました。"}${details}`);
        return;
      }
      setScoreCsvFile(null);
      const result: ImportResult = {
        imported: Number(data.imported ?? 0),
        skipped: Number(data.skipped ?? 0),
        failed: Number(data.failed ?? 0),
        createdAssignments: Number(data.createdAssignments ?? 0),
        failures: Array.isArray(data.failures) ? data.failures : [],
        importedRecords: Array.isArray(data.importedRecords) ? data.importedRecords : [],
        skippedRecords: Array.isArray(data.skippedRecords) ? data.skippedRecords : [],
      };
      setScoreCsvResult(result);
      setScoreCsvMessage(
        `大学別2次・添削点数CSVを ${result.imported} 件取り込みました。失敗 ${result.failed} 件、重複スキップ ${result.skipped} 件、課題作成 ${result.createdAssignments} 件。`,
      );
    } catch (err) {
      setScoreCsvError(err instanceof Error ? err.message : "CSV取り込みに失敗しました。");
    } finally {
      setScoreCsvImporting(false);
    }
  };

  if (loading) {
    return <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-700">読み込み中...</main>;
  }

  if (!user?.isSystemAdmin) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10">
        <section className="mx-auto max-w-3xl rounded border border-rose-200 bg-white p-6 shadow-sm">
          <Lock className="h-8 w-8 text-rose-600" />
          <h1 className="mt-4 text-2xl font-bold text-slate-900">403 Forbidden</h1>
          <p className="mt-2 text-sm text-slate-600">設定画面はシステム管理者のみ利用できます。</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
      <section className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded bg-slate-900 p-2 text-white">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-blue-600">SETTINGS</p>
            <h1 className="text-2xl font-black">設定</h1>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Link
            href="/settings/master"
            className="group rounded border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
          >
            <Database className="h-7 w-7 text-blue-600" />
            <h2 className="mt-4 text-lg font-bold">マスター管理</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              サナル本体から受領するCSVを、過去問演習システム側のマスターデータとして取り込みます。
            </p>
            <span className="mt-4 inline-flex text-sm font-bold text-blue-700 group-hover:underline">開く</span>
          </Link>

          <section className="rounded border border-slate-200 bg-white p-5 shadow-sm">
            <ClipboardList className="h-7 w-7 text-blue-600" />
            <h2 className="mt-4 text-lg font-bold">大学別2次・添削点数CSV</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              東大2次・京大2次・名大2次などの添削結果だけを取り込みます。共通テスト演習は生徒のマーク選択による自動採点結果を使います。
            </p>
            <a href="/csv-templates/secondary-score-sample.csv" download className="mt-4 inline-flex text-sm font-bold text-blue-700 underline">
              サンプルCSVをダウンロード
            </a>
            <div className="mt-4 grid gap-3">
              <input
                key={scoreCsvMessage}
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => setScoreCsvFile(event.target.files?.[0] ?? null)}
                className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={importScoreCsv}
                disabled={scoreCsvImporting}
                className="inline-flex items-center justify-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                {scoreCsvImporting ? "取り込み中..." : "取り込む"}
              </button>
            </div>
            {scoreCsvMessage && <div className="mt-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">{scoreCsvMessage}</div>}
            {scoreCsvError && <pre className="mt-3 max-h-44 overflow-auto whitespace-pre-wrap rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{scoreCsvError}</pre>}
            {scoreCsvResult && <SecondaryScoreImportResult result={scoreCsvResult} />}
          </section>
        </div>
      </section>
    </main>
  );
}

function SecondaryScoreImportResult({ result }: { result: ImportResult }) {
  const firstStudentId = result.importedRecords[0]?.studentId;

  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <ResultMetric label="取込成功" value={result.imported} tone="emerald" />
        <ResultMetric label="失敗" value={result.failed} tone="rose" />
        <ResultMetric label="重複スキップ" value={result.skipped} tone="slate" />
        <ResultMetric label="課題作成" value={result.createdAssignments} tone="blue" />
      </div>

      <div className="rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
        <p className="font-bold">表示先</p>
        <p className="mt-1 leading-6">
          成功した点数は「採点済み提出」として保存されています。教師側は「進捗確認」の大学別2次演習管理に、生徒ごとの点数・提出日・取込日として表示されます。
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Link href="/grading" className="inline-flex items-center gap-1 rounded bg-white px-3 py-1.5 text-xs font-bold text-blue-700 underline">
            進捗確認へ <ExternalLink className="h-3 w-3" />
          </Link>
          {firstStudentId && (
            <span className="inline-flex items-center rounded bg-white px-3 py-1.5 text-xs font-bold text-blue-900">
              確認用生徒ID: {firstStudentId}
            </span>
          )}
        </div>
      </div>

      {result.importedRecords.length > 0 && (
        <ResultTable
          title="取込成功の明細"
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
          rows={result.importedRecords.map((record) => ({
            key: `${record.rowIndex}-${record.submissionId}`,
            cells: [
              `${record.rowIndex}行目`,
              record.studentId,
              record.examTitle,
              `${record.score} / ${record.maxScore}`,
              formatDate(record.importedAt),
              record.examId,
            ],
          }))}
          headers={["行", "生徒ID", "課題", "点数", "取込日", "保存先演習ID"]}
        />
      )}

      {result.failures.length > 0 && (
        <ResultTable
          title="失敗の内訳"
          icon={<AlertCircle className="h-4 w-4 text-rose-600" />}
          rows={result.failures.map((failure) => ({
            key: `${failure.rowIndex}-${failure.studentId}-${failure.reason}`,
            cells: [
              `${failure.rowIndex}行目`,
              failure.studentId || "-",
              failure.examLabel || "-",
              failure.reason,
            ],
          }))}
          headers={["行", "生徒ID", "課題名", "理由"]}
        />
      )}

      {result.skippedRecords.length > 0 && (
        <ResultTable
          title="重複スキップの明細"
          rows={result.skippedRecords.map((record) => ({
            key: `${record.rowIndex}-${record.examId}-${record.studentId}`,
            cells: [`${record.rowIndex}行目`, record.studentId, record.examTitle, String(record.score), record.reason],
          }))}
          headers={["行", "生徒ID", "課題", "点数", "理由"]}
        />
      )}
    </div>
  );
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ja-JP");
}

function ResultMetric({ label, value, tone }: { label: string; value: number; tone: "emerald" | "rose" | "slate" | "blue" }) {
  const toneClass = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
    slate: "border-slate-200 bg-slate-50 text-slate-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
  }[tone];

  return (
    <div className={`rounded border px-3 py-2 ${toneClass}`}>
      <p className="text-xs font-bold">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}

function ResultTable({
  title,
  icon,
  headers,
  rows,
}: {
  title: string;
  icon?: ReactNode;
  headers: string[];
  rows: { key: string; cells: string[] }[];
}) {
  return (
    <section className="rounded border border-slate-200 bg-white p-3">
      <h3 className="flex items-center gap-2 text-sm font-black text-slate-900">
        {icon}
        {title}
      </h3>
      <div className="mt-3 max-h-80 overflow-auto rounded border border-slate-200">
        <table className="min-w-full text-left text-xs">
          <thead className="sticky top-0 bg-slate-100 text-slate-700">
            <tr>
              {headers.map((header) => (
                <th key={header} className="whitespace-nowrap px-3 py-2 font-black">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.key}>
                {row.cells.map((cell, index) => (
                  <td key={index} className="whitespace-nowrap px-3 py-2 text-slate-700">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
