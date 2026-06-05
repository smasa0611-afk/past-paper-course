"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FileAudio2,
  FileText,
  ListChecks,
  Search,
} from "lucide-react";
import type { ExamMetadata } from "@/types/exam";
import {
  buildRetakeRegistrations,
  getRetakeAssetSummary,
  retakeYears,
  type RetakeAssetStatus,
} from "@/lib/common-retake-assets";

const statusLabels: Record<RetakeAssetStatus, string> = {
  registered: "登録済み",
  needsReview: "確認待ち",
  pending: "掲載待ち",
};

const statusClasses: Record<RetakeAssetStatus, string> = {
  registered: "border-emerald-300/40 bg-emerald-500/20 text-emerald-50",
  needsReview: "border-blue-300/40 bg-blue-500/20 text-blue-50",
  pending: "border-amber-300/40 bg-amber-500/18 text-amber-100",
};

export default function CommonRetakeAdminPage() {
  const [exams, setExams] = useState<ExamMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState("2026");
  const [subject, setSubject] = useState("all");
  const [status, setStatus] = useState<"all" | RetakeAssetStatus>("all");
  const [checks, setChecks] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setYear(params.get("year") ?? "2026");
    setSubject(params.get("subject") ?? "all");
  }, []);

  useEffect(() => {
    fetch("/api/exams")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setExams(Array.isArray(data) ? data : []))
      .catch(() => setExams([]))
      .finally(() => setLoading(false));
  }, []);

  const registrations = useMemo(() => buildRetakeRegistrations(exams), [exams]);
  const subjectOptions = useMemo(() => {
    const subjects = new Map<string, string>();
    registrations.forEach((registration) => subjects.set(registration.subject, registration.subjectLabel));
    return [...subjects.entries()].sort((left, right) => left[1].localeCompare(right[1], "ja"));
  }, [registrations]);
  const filtered = registrations.filter((registration) => {
    const yearMatches = year === "all" || String(registration.year) === year;
    const subjectMatches = subject === "all" || registration.subject === subject;
    const statusMatches = status === "all" || registration.assets.some((asset) => asset.status === status);
    return yearMatches && subjectMatches && statusMatches;
  });
  const totals = registrations.reduce(
    (acc, registration) => {
      const summary = getRetakeAssetSummary(registration);
      acc.registered += summary.registered;
      acc.pending += summary.pending;
      acc.needsReview += summary.needsReview;
      acc.total += summary.total;
      return acc;
    },
    { registered: 0, pending: 0, needsReview: 0, total: 0 },
  );

  return (
    <main className="min-h-screen bg-[#06142a] px-4 py-6 text-white md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5">
          <Link
            href="/practice/common?mode=reinforcement"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-sm font-bold text-cyan-100 transition hover:bg-white/12 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            演習カタログへ戻る
          </Link>
        </div>

        <section className="rounded-[24px] border border-cyan-300/20 bg-[#0b2344] p-5 shadow-[0_28px_90px_rgba(0,12,34,0.38)]">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-300">Retake Data Registry</p>
          <h1 className="mt-2 text-3xl font-black">共通テスト追・再試験データ回収・登録</h1>
          <p className="mt-3 max-w-4xl text-sm font-bold leading-7 text-slate-300">
            2026年度から2022年度の追・再試験素材を、弱点補強演習の素材として回収・登録・確認します。生徒画面では「弱点補強演習」として扱います。
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <Metric label="素材合計" value={totals.total} />
            <Metric label="登録済み" value={totals.registered} />
            <Metric label="確認待ち" value={totals.needsReview} />
            <Metric label="掲載待ち" value={totals.pending} />
          </div>
        </section>

        <section className="mt-5 rounded-xl border border-white/10 bg-white/6 p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Select label="年度" value={year} onChange={setYear}>
              <option value="all">すべて</option>
              {retakeYears.map((item) => (
                <option key={item} value={String(item)}>
                  {item}年度
                </option>
              ))}
            </Select>
            <Select label="科目" value={subject} onChange={setSubject}>
              <option value="all">すべて</option>
              {subjectOptions.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
            <Select label="状態" value={status} onChange={(value) => setStatus(value as "all" | RetakeAssetStatus)}>
              <option value="all">すべて</option>
              <option value="registered">登録済み</option>
              <option value="needsReview">確認待ち</option>
              <option value="pending">掲載待ち</option>
            </Select>
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-2xl border border-cyan-300/20 bg-[#0b2344]">
          {loading ? (
            <div className="p-10 text-center font-bold text-slate-300">読み込み中...</div>
          ) : (
            <div className="divide-y divide-slate-500/24">
              {filtered.map((registration) => {
                const summary = getRetakeAssetSummary(registration);
                return (
                  <article key={`${registration.year}-${registration.subject}`} className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-black text-cyan-200">{registration.reiwa}</p>
                        <h2 className="mt-1 text-2xl font-black">
                          {registration.year}年度 {registration.subjectLabel} 弱点補強演習
                        </h2>
                        <p className="mt-2 text-sm font-bold text-slate-400">
                          登録済み {summary.registered}/{summary.total}、確認待ち {summary.needsReview}、掲載待ち {summary.pending}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <OfficialLink href={registration.officialYearUrl} label="年度ページ" />
                        <OfficialLink href={registration.answerUrl} label="正解ページ" />
                        {registration.problemUrl && <OfficialLink href={registration.problemUrl} label="問題ページ" />}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      {registration.assets.map((asset) => {
                        const checkKey = `${registration.year}-${registration.subject}-${asset.kind}`;
                        return (
                          <div key={asset.kind} className="rounded-xl border border-white/10 bg-white/6 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <AssetIcon kind={asset.kind} />
                                <div>
                                  <p className="font-black text-white">{asset.label}</p>
                                  <p className="mt-1 text-sm font-bold leading-6 text-slate-300">{asset.note}</p>
                                </div>
                              </div>
                              <span className={`shrink-0 rounded-md border px-3 py-1.5 text-xs font-black ${statusClasses[asset.status]}`}>
                                {statusLabels[asset.status]}
                              </span>
                            </div>
                            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                              {asset.url ? (
                                <a
                                  href={asset.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-2 text-sm font-black text-cyan-200 hover:text-white"
                                >
                                  回収元を開く
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              ) : (
                                <span className="text-sm font-bold text-slate-500">ローカル定義</span>
                              )}
                              <label className="inline-flex items-center gap-2 text-sm font-black text-slate-100">
                                <input
                                  type="checkbox"
                                  checked={Boolean(checks[checkKey])}
                                  onChange={(event) =>
                                    setChecks((current) => ({ ...current, [checkKey]: event.target.checked }))
                                  }
                                  className="h-4 w-4 accent-cyan-400"
                                />
                                確認済み
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                );
              })}

              {filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                  <Search className="mb-3 h-10 w-10 text-slate-500" />
                  <p className="text-lg font-black text-white">条件に合う登録データがありません</p>
                  <p className="mt-2 text-sm text-slate-400">年度・科目・状態の条件を変更してください。</p>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/7 p-4">
      <p className="text-xs font-bold text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-black text-slate-300">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border border-white/10 bg-[#081b38] px-3 py-2.5 text-sm font-bold text-white outline-none transition focus:border-blue-300"
      >
        {children}
      </select>
    </label>
  );
}

function OfficialLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/8 px-3 py-2 text-xs font-black text-slate-100 transition hover:bg-white/14"
    >
      {label}
      <ExternalLink className="h-4 w-4" />
    </a>
  );
}

function AssetIcon({ kind }: { kind: string }) {
  if (kind === "listeningAudio") return <FileAudio2 className="h-5 w-5 text-cyan-300" />;
  if (kind === "marksheet") return <ListChecks className="h-5 w-5 text-cyan-300" />;
  if (kind === "answer") return <CheckCircle2 className="h-5 w-5 text-cyan-300" />;
  return <FileText className="h-5 w-5 text-cyan-300" />;
}
