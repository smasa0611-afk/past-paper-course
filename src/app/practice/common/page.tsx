"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  FileText,
  Filter,
  GraduationCap,
  LayoutList,
  PlayCircle,
  Search,
  ShieldCheck,
} from "lucide-react";
import type { ExamMetadata } from "@/types/exam";
import {
  buildRetakeRegistrations,
  commonSubjectLabels,
  getRetakeAssetSummary,
  type PracticeVariant,
  type RetakeAssetStatus,
  type RetakeRegistration,
} from "@/lib/common-retake-assets";

type User = { id: string; name: string; role: "student" | "teacher" };
type SelectOption = { key: string; label: string };
type CatalogStatus = "all" | "not-started" | "in-progress" | "done";
type SupportFilter = "all" | "marksheet" | "answer";
type Submission = {
  id: string;
  examId: string;
  studentId: string;
  timestamp: string;
  status: string;
  score?: number;
  maxScore?: number;
  gradedAt?: string;
};
type SupportSummary = {
  year: number;
  total: number;
  marksheet: number;
  answer: number;
};
type CourseGoal = {
  university: string;
  faculty: string;
  department: string;
} | null;
type CourseProfile = {
  goal: CourseGoal;
};

const subjectLabels: Record<string, string> = {
  english: "英語リーディング",
  english_listening: "英語リスニング",
  japanese: "国語",
  math_ia: "数学 I A",
  math_iibc: "数学 II BC",
  japanese_history: "歴史総合・日本史探究",
  world_history: "歴史総合・世界史探究",
  geography: "地理総合・地理探究",
  public_ethics: "公共、倫理",
  public_politics_economy: "公共、政治・経済",
  integrated_history_public: "地理総合・歴史総合・公共",
  science_basics: "理科基礎",
  physics: "物理",
  chemistry: "化学",
  biology: "生物",
  earth_science: "地学",
  information_i: "情報 I",
  math_i: "数学 I",
  math_ii: "数学 II",
  math_iib: "数学 II B",
  world_history_a: "世界史 A",
  world_history_b: "世界史 B",
  japanese_history_a: "日本史 A",
  japanese_history_b: "日本史 B",
  geography_a: "地理 A",
  geography_b: "地理 B",
  modern_society: "現代社会",
  ethics: "倫理",
  politics_economy: "政治・経済",
  ethics_politics_economy: "倫理・政経",
  physics_basics: "物理基礎",
  chemistry_basics: "化学基礎",
  biology_basics: "生物基礎",
  earth_science_basics: "地学基礎",
  bookkeeping_accounting: "簿記・会計",
  information_related_basics: "情報関係基礎",
};

function getSubjectLabel(subject: string) {
  return commonSubjectLabels[subject] ?? subjectLabels[subject] ?? subject;
}

function formatGoalTitle(goal: CourseGoal) {
  if (!goal?.university) return "志望校未取り込み";
  return [goal.university, goal.faculty].filter(Boolean).join(" ");
}

function formatGoalDetail(goal: CourseGoal) {
  if (!goal?.university) return "佐鳴システムの志望校情報を表示します";
  return ["前期日程", goal.department].filter(Boolean).join(" / ");
}

function normalizeExamId(examId: string) {
  return examId.replace(/\\/g, "/").trim();
}

function sortCommonExams(left: ExamMetadata, right: ExamMetadata) {
  if (left.year !== right.year) return right.year - left.year;
  return getSubjectLabel(left.subject).localeCompare(getSubjectLabel(right.subject), "ja");
}

function buildSupportSummaries(exams: ExamMetadata[]): SupportSummary[] {
  const summaries = new Map<number, SupportSummary>();

  exams.forEach((exam) => {
    const summary =
      summaries.get(exam.year) ??
      ({
        year: exam.year,
        total: 0,
        marksheet: 0,
        answer: 0,
      } satisfies SupportSummary);

    summary.total += 1;
    if (exam.hasMarksheet) summary.marksheet += 1;
    if (exam.hasAnswer) summary.answer += 1;
    summaries.set(exam.year, summary);
  });

  return [...summaries.values()].sort((left, right) => right.year - left.year);
}

function getLatestByExam(submissions: Submission[]) {
  const map = new Map<string, Submission>();

  submissions.forEach((submission) => {
    const key = normalizeExamId(submission.examId);
    const current = map.get(key);
    if (!current || new Date(submission.timestamp).getTime() > new Date(current.timestamp).getTime()) {
      map.set(key, submission);
    }
  });

  return map;
}

function getCatalogStatus(submission?: Submission): Exclude<CatalogStatus, "all"> {
  if (!submission) return "not-started";
  if (typeof submission.score === "number" || submission.status === "graded") return "done";
  return "in-progress";
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function scoreText(submission?: Submission) {
  if (!submission || typeof submission.score !== "number") return "-";
  const max = submission.maxScore ?? 100;
  return `${submission.score} / ${max}`;
}

export default function CommonPracticePage() {
  const [user, setUser] = useState<User | null>(null);
  const [goal, setGoal] = useState<CourseGoal>(null);
  const [exams, setExams] = useState<ExamMetadata[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogMode, setCatalogMode] = useState<PracticeVariant>("main");
  const [year, setYear] = useState("all");
  const [subject, setSubject] = useState("all");
  const [status, setStatus] = useState<CatalogStatus>("all");
  const [support, setSupport] = useState<SupportFilter>("all");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedMode = params.get("mode");
    const requestedYear = params.get("year");
    const requestedSubject = params.get("subject");
    if (requestedMode === "reinforcement" || requestedMode === "main") {
      setCatalogMode(requestedMode);
    }
    if (requestedYear) setYear(requestedYear);
    if (requestedSubject) setSubject(requestedSubject);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then((res) => (res.ok ? res.json() : { user: null })),
      fetch("/api/student-course-profile").then((res) => (res.ok ? res.json() : null)),
      fetch("/api/exams").then((res) => (res.ok ? res.json() : [])),
      fetch("/api/submissions").then((res) => (res.ok ? res.json() : [])),
    ])
      .then(([me, profile, examData, submissionData]) => {
        setUser(me.user);
        setGoal((profile as CourseProfile | null)?.goal ?? null);
        setExams(Array.isArray(examData) ? examData : []);
        setSubmissions(Array.isArray(submissionData) ? submissionData : []);
      })
      .catch(() => {
        setUser(null);
        setGoal(null);
        setExams([]);
        setSubmissions([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const commonExams = useMemo(
    () =>
      exams
        .filter((exam) => exam.exam_type === "common" && normalizeExamId(exam.id).startsWith("common/"))
        .sort(sortCommonExams),
    [exams],
  );
  const retakeRegistrations = useMemo(() => buildRetakeRegistrations(exams), [exams]);

  const latestByExam = useMemo(() => getLatestByExam(submissions), [submissions]);
  const supportSummaries = useMemo(() => buildSupportSummaries(commonExams), [commonExams]);
  const completedCount = useMemo(
    () => commonExams.filter((exam) => getCatalogStatus(latestByExam.get(normalizeExamId(exam.id))) === "done").length,
    [commonExams, latestByExam],
  );
  const marksheetCount = useMemo(() => commonExams.filter((exam) => exam.hasMarksheet).length, [commonExams]);
  const answerCount = useMemo(() => commonExams.filter((exam) => exam.hasAnswer).length, [commonExams]);

  const yearOptions = useMemo<SelectOption[]>(() => {
    const uniqueYears = Array.from(new Set(commonExams.map((exam) => String(exam.year)))).sort(
      (left, right) => Number(right) - Number(left),
    );
    return [{ key: "all", label: "すべて" }, ...uniqueYears.map((item) => ({ key: item, label: `${item}年度` }))];
  }, [commonExams]);

  const subjectOptions = useMemo<SelectOption[]>(() => {
    const uniqueSubjects = Array.from(new Set(commonExams.map((exam) => exam.subject))).sort((left, right) =>
      getSubjectLabel(left).localeCompare(getSubjectLabel(right), "ja"),
    );

    return [
      { key: "all", label: "すべて" },
      ...uniqueSubjects.map((item) => ({
        key: item,
        label: getSubjectLabel(item),
      })),
    ];
  }, [commonExams]);

  const catalog = useMemo(() => {
    return commonExams.filter((exam) => {
      const submission = latestByExam.get(normalizeExamId(exam.id));
      const examStatus = getCatalogStatus(submission);
      const yearMatches = year === "all" || String(exam.year) === year;
      const subjectMatches = subject === "all" || exam.subject === subject;
      const statusMatches = status === "all" || examStatus === status;
      const supportMatches =
        support === "all" ||
        (support === "marksheet" && Boolean(exam.hasMarksheet)) ||
        (support === "answer" && Boolean(exam.hasAnswer));
      return yearMatches && subjectMatches && statusMatches && supportMatches;
    });
  }, [commonExams, latestByExam, status, subject, support, year]);
  const reinforcementCatalog = useMemo(() => {
    return retakeRegistrations.filter((registration) => {
      const yearMatches = year === "all" || String(registration.year) === year;
      const subjectMatches = subject === "all" || registration.subject === subject;
      const supportMatches =
        support === "all" ||
        (support === "marksheet" && registration.assets.some((asset) => asset.kind === "marksheet" && asset.status === "registered")) ||
        (support === "answer" && registration.assets.some((asset) => asset.kind === "answer" && asset.status === "registered"));
      return yearMatches && subjectMatches && supportMatches;
    });
  }, [retakeRegistrations, subject, support, year]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-blue-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-6">
        <div className="glass-card w-full max-w-md rounded-[28px] p-8 text-center shadow-[0_24px_80px_rgba(5,12,28,0.26)]">
          <BookOpenCheck className="mx-auto mb-4 h-10 w-10 text-blue-400" />
          <h1 className="mb-3 text-2xl font-black text-slate-950">生徒ログインが必要です</h1>
          <p className="mb-6 text-sm leading-6 text-slate-600">
            共通テスト演習カタログを開くには、生徒アカウントでログインしてください。
          </p>
          <Link href="/login" className="glass-button-primary inline-flex px-5 py-3 text-sm font-bold">
            ログインへ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#06142a] text-white">
      <div className="mx-auto grid w-full max-w-[1760px] gap-0 lg:grid-cols-[315px_1fr]">
        <CatalogSidebar
          user={user}
          total={commonExams.length}
          completed={completedCount}
          marksheet={marksheetCount}
          answer={answerCount}
          recent={submissions.slice(0, 4)}
          goal={goal}
        />

        <main className="min-w-0 border-l border-white/10 px-4 py-6 md:px-7 lg:px-10">
          <div className="mb-5">
            <Link
              href="/practice"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-sm font-bold text-cyan-100 transition hover:bg-white/12 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              演習メニューに戻る
            </Link>
          </div>

          <section className="mb-6 grid gap-4 xl:grid-cols-[1fr_390px] xl:items-end">
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-[0.32em] text-cyan-300">COMMON TEST CATALOG</p>
              <h1 className="text-3xl font-black tracking-[0.02em] md:text-4xl">共通テスト演習カタログ</h1>
            <p className="mt-3 max-w-4xl text-[15px] font-bold leading-7 text-slate-300">
                全年度・全科目の問題PDF、マークシート対応、解答解説PDFを一覧で確認できます。
                通常演習はダッシュボードのマップから、探して開くときはこのカタログから進めます。
              </p>
            </div>

            <Link
              href="/results"
              className="rounded-2xl border border-blue-300/20 bg-blue-500/10 p-4 text-left shadow-[0_18px_50px_rgba(20,55,120,0.22)] transition hover:bg-blue-500/15"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-200">
                    <BarChart3 className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-cyan-200">全年度の進捗レポート</p>
                    <p className="mt-1 text-lg font-black text-white">ダッシュボードへ戻る</p>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-cyan-200" />
              </div>
            </Link>
          </section>

          <section className="mb-4 rounded-xl border border-white/10 bg-white/6 p-2 shadow-[0_12px_34px_rgba(0,0,0,0.18)]">
            <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-center">
              <div className="inline-grid grid-cols-2 rounded-lg border border-white/10 bg-[#081b38] p-1">
                <button
                  type="button"
                  onClick={() => setCatalogMode("main")}
                  className={`rounded-md px-4 py-2 text-sm font-black transition ${
                    catalogMode === "main" ? "bg-blue-500 text-white" : "text-slate-300 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  本試験演習
                </button>
                <button
                  type="button"
                  onClick={() => setCatalogMode("reinforcement")}
                  className={`rounded-md px-4 py-2 text-sm font-black transition ${
                    catalogMode === "reinforcement" ? "bg-cyan-500 text-white" : "text-slate-300 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  弱点補強演習
                </button>
              </div>
              <Link
                href="/practice/common/retake-admin"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-100 transition hover:bg-cyan-400/16"
              >
                追・再試験データ回収・登録
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            {catalogMode === "reinforcement" && (
              <p className="mt-3 rounded-lg border border-cyan-300/18 bg-cyan-400/8 px-3 py-2 text-sm font-bold leading-6 text-cyan-50/90">
                生徒画面では「追試験」を前面に出さず、同年度・同科目の弱点補強演習として表示します。
              </p>
            )}
          </section>

          <section className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {supportSummaries.map((summary) => (
              <button
                key={summary.year}
                type="button"
                onClick={() => setYear(String(summary.year))}
                className={`min-w-[190px] rounded-xl border p-3 text-left shadow-[0_10px_28px_rgba(0,0,0,0.16)] transition hover:-translate-y-0.5 ${
                  year === String(summary.year)
                    ? "border-blue-300/60 bg-blue-500/18"
                    : "border-white/10 bg-white/6 hover:bg-white/10"
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-base font-black text-white">{summary.year}年度</p>
                  <FileText className="h-4 w-4 text-blue-300" />
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <SummaryCell label="問題" value={`${summary.total}科目`} />
                  <SummaryCell label="マーク" value={`${summary.marksheet}科目`} />
                  <SummaryCell label="解説" value={`${summary.answer}科目`} />
                </div>
                <div className="mt-3">
                  <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold text-slate-300">
                    <span>全科目対応状況</span>
                    <span>{Math.round((summary.marksheet / Math.max(summary.total, 1)) * 100)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-blue-400"
                      style={{ width: `${Math.round((summary.marksheet / Math.max(summary.total, 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              </button>
            ))}
          </section>

          <section className="mb-4 rounded-xl border border-white/10 bg-white/6 p-3 shadow-[0_12px_34px_rgba(0,0,0,0.18)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/20 px-3 py-1.5 text-xs font-black text-blue-100">
                <Filter className="h-4 w-4" />
                表示フィルター
              </div>
              <button
                type="button"
                onClick={() => {
                  setYear("all");
                  setSubject("all");
                  setStatus("all");
                  setSupport("all");
                }}
                className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-bold text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                条件をクリア
              </button>
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              <SelectField label="年度" value={year} onChange={setYear} options={yearOptions} />
              <SelectField label="科目" value={subject} onChange={setSubject} options={subjectOptions} />
              <SelectField
                label="ステータス"
                value={status}
                onChange={(value) => setStatus(value as CatalogStatus)}
                options={[
                  { key: "all", label: "すべて" },
                  { key: "not-started", label: "未受講" },
                  { key: "in-progress", label: "受講中" },
                  { key: "done", label: "受講済み" },
                ]}
              />
              <SelectField
                label="対応状況"
                value={support}
                onChange={(value) => setSupport(value as SupportFilter)}
                options={[
                  { key: "all", label: "すべて" },
                  { key: "marksheet", label: "マーク対応あり" },
                  { key: "answer", label: "解答解説あり" },
                ]}
              />
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-cyan-300/20 bg-[#0b2344] shadow-[0_28px_90px_rgba(0,12,34,0.38)] ring-1 ring-cyan-300/10">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-500/30 bg-[#0d274b] px-4 py-4">
              <div className="flex items-center gap-2">
                <LayoutList className="h-5 w-5 text-cyan-300" />
                <h2 className="text-lg font-black">演習一覧</h2>
              </div>
              <p className="text-sm font-bold text-slate-300">
                {catalogMode === "main"
                  ? `全 ${commonExams.length} 件中 ${catalog.length} 件を表示`
                  : `全 ${retakeRegistrations.length} 件中 ${reinforcementCatalog.length} 件を表示`}
              </p>
            </div>

            {catalogMode === "main" ? (
              <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] border-collapse text-left text-[15px]">
                <thead>
                  <tr className="border-b border-slate-500/35 bg-white/8 text-xs font-black uppercase tracking-[0.08em] text-slate-200">
                    <th className="px-4 py-3">年度</th>
                    <th className="px-4 py-3">科目</th>
                    <th className="px-4 py-3">問題PDF</th>
                    <th className="px-4 py-3">マークシート</th>
                    <th className="px-4 py-3">解答解説PDF</th>
                    <th className="px-4 py-3">受講状況</th>
                    <th className="px-4 py-3">得点</th>
                    <th className="px-4 py-3">最終演習日</th>
                    <th className="px-4 py-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {catalog.map((exam) => {
                    const normalizedId = normalizeExamId(exam.id);
                    const submission = latestByExam.get(normalizedId);
                    const examStatus = getCatalogStatus(submission);
                    const examUrl = `/exam/${normalizedId}`;
                    return (
                      <tr key={exam.id} className="border-b border-slate-500/24 bg-[#0b2344] text-slate-100 transition hover:bg-[#102b52]">
                        <td className="px-4 py-3 font-black text-white">{exam.year}</td>
                        <td className="px-4 py-3">
                          <div className="font-black text-white">{getSubjectLabel(exam.subject)}</div>
                          <div className="mt-1 max-w-[260px] truncate text-xs text-slate-400">{exam.title || normalizedId}</div>
                        </td>
                        <td className="px-4 py-3">
                          <AvailabilityPill available label="配置済み" />
                        </td>
                        <td className="px-4 py-3">
                          <AvailabilityPill available={Boolean(exam.hasMarksheet)} label="対応あり" emptyLabel="未対応" />
                        </td>
                        <td className="px-4 py-3">
                          <AvailabilityPill available={Boolean(exam.hasAnswer)} label="配置済み" emptyLabel="未登録" />
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill status={examStatus} />
                        </td>
                        <td className="px-4 py-3 font-mono font-black text-white">{scoreText(submission)}</td>
                        <td className="px-4 py-3 text-slate-300">{formatDate(submission?.timestamp)}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end">
                            <Link
                              href={examUrl}
                              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/8 px-3 py-2 text-xs font-black text-slate-100 transition hover:bg-white/14"
                            >
                              <PlayCircle className="h-4 w-4" />
                              演習へ
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {catalog.length === 0 && (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <Search className="mb-3 h-10 w-10 text-slate-500" />
                <p className="text-lg font-black text-white">条件に合う演習がありません</p>
                <p className="mt-2 text-sm text-slate-400">フィルターを変更して、年度や科目を広げてください。</p>
              </div>
            )}
              </>
            ) : (
              <ReinforcementCatalogTable registrations={reinforcementCatalog} latestByExam={latestByExam} />
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

function CatalogSidebar({
  user,
  goal,
  total,
  completed,
  marksheet,
  answer,
  recent,
}: {
  user: User;
  goal: CourseGoal;
  total: number;
  completed: number;
  marksheet: number;
  answer: number;
  recent: Submission[];
}) {
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <aside className="bg-[linear-gradient(180deg,#092142_0%,#071a35_50%,#051226_100%)] px-4 py-5 text-white lg:min-h-[calc(100vh-96px)]">
      <section className="rounded-xl border border-white/10 bg-white/7 p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-black text-slate-100">生徒情報</p>
          <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] font-bold text-slate-300">演習中</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-100">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-black">{user.name}</p>
            <p className="mt-1 text-xs font-bold text-slate-400">@{user.id}</p>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-white/10 bg-white/7 p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-black text-slate-100">志望校</p>
          <GraduationCap className="h-5 w-5 text-cyan-300" />
        </div>
        <p className="text-xl font-black">{formatGoalTitle(goal)}</p>
        <p className="mt-1 text-xs font-bold text-slate-400">{formatGoalDetail(goal)}</p>
      </section>

      <section className="mt-4 rounded-xl border border-white/10 bg-white/7 p-4">
        <p className="text-sm font-black text-slate-100">学習進捗サマリー</p>
        <div className="mt-3 flex items-end gap-2">
          <span className="text-4xl font-black text-cyan-300">{progress}%</span>
          <span className="pb-1 text-sm font-bold text-slate-300">完了</span>
        </div>
        <div className="mt-3 h-3 rounded-full bg-white/10">
          <div className="h-full rounded-full bg-cyan-400" style={{ width: `${progress}%` }} />
        </div>
      <div className="mt-4 grid grid-cols-3 gap-1.5">
          <SidebarMiniStat label="受講済み" value={`${completed}科目`} />
          <SidebarMiniStat label="マーク" value={`${marksheet}科目`} />
          <SidebarMiniStat label="解説" value={`${answer}科目`} />
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-white/10 bg-white/7 p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-black text-slate-100">直近の演習履歴</p>
          <span className="text-xs font-bold text-cyan-200">最新4件</span>
        </div>
        <div className="space-y-2">
          {recent.map((item) => (
            <div key={item.id} className="rounded-lg bg-white/6 px-3 py-2">
              <p className="truncate text-xs font-black text-white">{normalizeExamId(item.examId)}</p>
              <p className="mt-1 text-[11px] font-bold text-slate-400">
                {formatDate(item.timestamp)} / {scoreText(item)}
              </p>
            </div>
          ))}
          {recent.length === 0 && <p className="text-sm font-bold text-slate-400">演習履歴はまだありません。</p>}
        </div>
      </section>
    </aside>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 p-2">
      <p className="text-[11px] font-bold text-slate-300">{label}</p>
      <p className="mt-1 text-sm font-black text-white">{value}</p>
    </div>
  );
}

function SidebarMiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/6 p-2">
      <p className="text-[11px] font-bold text-slate-400">{label}</p>
      <p className="mt-1 text-[13px] font-black text-white">{value}</p>
    </div>
  );
}

function ReinforcementCatalogTable({
  registrations,
  latestByExam,
}: {
  registrations: RetakeRegistration[];
  latestByExam: Map<string, Submission>;
}) {
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] border-collapse text-left text-[15px]">
          <thead>
            <tr className="border-b border-slate-500/35 bg-white/8 text-xs font-black uppercase tracking-[0.08em] text-slate-200">
              <th className="px-4 py-3">年度</th>
              <th className="px-4 py-3">科目</th>
              <th className="px-4 py-3">問題PDF</th>
              <th className="px-4 py-3">マークシート</th>
              <th className="px-4 py-3">解答解説PDF</th>
              <th className="px-4 py-3">受講状況</th>
              <th className="px-4 py-3">得点</th>
              <th className="px-4 py-3">最終演習日</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {registrations.map((registration) => {
              const summary = getRetakeAssetSummary(registration);
              const problem = registration.assets.find((asset) => asset.kind === "problem");
              const answer = registration.assets.find((asset) => asset.kind === "answer");
              const marksheet = registration.assets.find((asset) => asset.kind === "marksheet");
              const normalizedId = normalizeExamId(registration.reinforcementExamId);
              const submission = latestByExam.get(normalizedId);
              const examStatus = getCatalogStatus(submission);

              return (
                <tr
                  key={`${registration.year}-${registration.subject}`}
                  className="border-b border-slate-500/24 bg-[#0b2344] text-slate-100 transition hover:bg-[#102b52]"
                >
                  <td className="px-4 py-3 font-black text-white">
                    {registration.year}
                    <div className="mt-1 text-xs font-bold text-slate-400">{registration.reiwa}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-black text-white">{registration.subjectLabel}</div>
                    <div className="mt-1 text-xs text-cyan-100/75">弱点補強演習</div>
                  </td>
                  <td className="px-4 py-3">
                    <RetakeStatusPill status={problem?.status ?? "pending"} />
                  </td>
                  <td className="px-4 py-3">
                    <RetakeStatusPill status={marksheet?.status ?? "pending"} />
                  </td>
                  <td className="px-4 py-3">
                    <RetakeStatusPill status={answer?.status ?? "pending"} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={examStatus} />
                  </td>
                  <td className="px-4 py-3 font-mono font-black text-white">{scoreText(submission)}</td>
                  <td className="px-4 py-3 text-slate-300">{formatDate(submission?.timestamp)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/exam/${normalizedId}`}
                        className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/8 px-3 py-2 text-xs font-black text-slate-100 transition hover:bg-white/14"
                      >
                        <PlayCircle className="h-4 w-4" />
                        演習へ
                      </Link>
                      <Link
                        href={`/practice/common/retake-admin?year=${registration.year}&subject=${registration.subject}`}
                        className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-xs font-black text-cyan-100 transition hover:bg-cyan-400/16"
                      >
                        確認
                      </Link>
                    </div>
                    <div className="mt-2 text-right text-[11px] font-bold text-slate-400">
                      登録済み {summary.registered}/{summary.total}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {registrations.length === 0 && (
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <Search className="mb-3 h-10 w-10 text-slate-500" />
          <p className="text-lg font-black text-white">条件に合う弱点補強演習がありません</p>
          <p className="mt-2 text-sm text-slate-400">年度または科目の条件を変更してください。</p>
        </div>
      )}
    </>
  );
}

function RetakeStatusPill({
  status,
  compact = false,
  label,
}: {
  status: RetakeAssetStatus;
  compact?: boolean;
  label?: string;
}) {
  const text = status === "registered" ? "登録済み" : status === "needsReview" ? "確認待ち" : "掲載待ち";
  const color =
    status === "registered"
      ? "border-emerald-300/40 bg-emerald-500/22 text-emerald-50"
      : status === "needsReview"
        ? "border-blue-300/40 bg-blue-500/24 text-blue-50"
        : "border-amber-300/35 bg-amber-500/18 text-amber-100";
  return (
    <span className={`inline-flex items-center justify-center rounded-md border font-black ${color} ${compact ? "px-2 py-1 text-[11px]" : "min-w-20 px-3 py-1.5 text-xs"}`}>
      {label ? `${label}:${text}` : text}
    </span>
  );
}

function AvailabilityPill({
  available,
  label,
  emptyLabel = "なし",
}: {
  available: boolean;
  label: string;
  emptyLabel?: string;
}) {
  return (
    <span
      className={`inline-flex min-w-20 items-center justify-center rounded-md px-3 py-1.5 text-xs font-black ${
        available ? "border border-cyan-300/35 bg-cyan-500/22 text-cyan-50" : "border border-slate-500/18 bg-slate-700/28 text-slate-400"
      }`}
    >
      {available ? label : emptyLabel}
    </span>
  );
}

function StatusPill({ status }: { status: Exclude<CatalogStatus, "all"> }) {
  if (status === "done") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-300/40 bg-emerald-500/22 px-3 py-1.5 text-xs font-black text-emerald-50">
        <CheckCircle2 className="h-3.5 w-3.5" />
        受講済み
      </span>
    );
  }
  if (status === "in-progress") {
    return <span className="inline-flex rounded-md border border-blue-300/40 bg-blue-500/24 px-3 py-1.5 text-xs font-black text-blue-50">受講中</span>;
  }
  return <span className="inline-flex rounded-md border border-amber-300/35 bg-amber-500/18 px-3 py-1.5 text-xs font-black text-amber-100">未受講</span>;
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-black text-slate-300">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border border-white/10 bg-[#081b38] px-3 py-2.5 text-sm font-bold text-white outline-none transition focus:border-blue-300"
      >
        {options.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
