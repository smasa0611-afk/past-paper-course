"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BookMarked,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ClipboardList,
  History,
  Map as MapIcon,
  RotateCcw,
} from "lucide-react";
import type { ExamMetadata } from "@/types/exam";
import type { StoredSubmission } from "@/lib/submission-storage";

type User = { id: string; name: string; role: "student" | "teacher" };
type CourseGoal = {
  university: string;
  faculty: string;
  department: string;
  method?: string;
  schedule?: string;
  targetRate?: number | null;
} | null;

type CourseProfile = {
  goal: CourseGoal;
  enrollments?: { courseName?: string; courseCategory?: string; grade?: string; year?: string }[];
  hasSecondaryCourse?: boolean;
};

type Assignment = {
  id: string;
  studentId: string;
  examId: string;
  dueDate: string;
};

type AssignmentDueStatus = {
  label: string;
  tone: "future" | "today" | "overdue";
};

type SubjectMeta = {
  label: string;
  shortLabel: string;
  slug: string;
  max: number;
  aliases: string[];
};

const UNWEIGHTED_TOTAL = 1000;
const COMMON_TEST_START = new Date("2027-01-16T00:00:00+09:00");
const COMMON_TEST_DATES_LABEL = "2027年1月16日(土)・17日(日)";

const subjectMetas: SubjectMeta[] = [
  { label: "英語R", shortLabel: "英R", slug: "english", max: 100, aliases: ["english", "english_r", "reading"] },
  { label: "英語L", shortLabel: "英L", slug: "english_listening", max: 100, aliases: ["english_listening", "listening"] },
  { label: "数学IA", shortLabel: "数IA", slug: "math_ia", max: 100, aliases: ["math_ia"] },
  { label: "数学IIBC", shortLabel: "数IIBC", slug: "math_iibc", max: 100, aliases: ["math_iibc", "math_iib"] },
  { label: "国語", shortLabel: "国語", slug: "japanese", max: 200, aliases: ["japanese"] },
  {
    label: "理科1",
    shortLabel: "理1",
    slug: "science_1",
    max: 100,
    aliases: ["physics", "biology", "earth_science", "physics_basics", "biology_basics", "earth_science_basics", "science_basics", "science_1"],
  },
  { label: "理科2", shortLabel: "理2", slug: "science_2", max: 100, aliases: ["chemistry", "chemistry_basics", "science_2"] },
  {
    label: "社会1",
    shortLabel: "社1",
    slug: "social_1",
    max: 100,
    aliases: [
      "japanese_history",
      "japanese_history_a",
      "japanese_history_b",
      "world_history",
      "world_history_a",
      "world_history_b",
      "geography",
      "geography_a",
      "geography_b",
      "integrated_history_public",
      "social_1",
    ],
  },
  {
    label: "社会2",
    shortLabel: "社2",
    slug: "social_2",
    max: 100,
    aliases: [
      "public",
      "public_ethics",
      "public_politics_economy",
      "politics_economy",
      "ethics",
      "ethics_politics_economy",
      "modern_society",
      "social_2",
    ],
  },
  { label: "情報", shortLabel: "情報", slug: "information_i", max: 100, aliases: ["information_i", "information", "information_related_basics"] },
];

function normalizeExamId(examId: string) {
  return examId.replace(/^\/+/, "").replace(/\\/g, "/");
}

function getExamHref(exam: ExamMetadata) {
  return `/exam/${normalizeExamId(exam.id)}`;
}

function analysisHref(exam: ExamMetadata) {
  return `/results/${exam.year}/${exam.subject}`;
}

function getMainExamIdFromReinforcement(examId: string) {
  const normalized = normalizeExamId(examId).split("?")[0];
  if (normalized.startsWith("common_retake/")) return normalized.replace(/^common_retake\//, "common/");
  return null;
}

function getSubjectMeta(subject: string) {
  return subjectMetas.find((item) => item.aliases.includes(subject)) ?? null;
}

function getSubjectKey(subject: string) {
  return getSubjectMeta(subject)?.slug ?? subject;
}

function normalizeScore(submission: StoredSubmission, max: number) {
  if (typeof submission.score !== "number") return null;
  if (!submission.maxScore || submission.maxScore <= 0) return Math.round(submission.score);
  return Math.round((submission.score / submission.maxScore) * max);
}

function formatDate(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatGoalTitle(goal: CourseGoal) {
  if (!goal?.university) return "志望校未取り込み";
  return [goal.university, goal.faculty].filter(Boolean).join(" ");
}

function formatGoalDetail(goal: CourseGoal) {
  if (!goal?.university) return "佐鳴システムの志望校情報を表示します";
  return [goal.method || goal.schedule, goal.department].filter(Boolean).join(" / ");
}

function scoreClass(score: number, max: number) {
  const rate = max > 0 ? score / max : 0;
  if (rate >= 0.9) return "bg-emerald-500 text-white";
  if (rate >= 0.8) return "bg-blue-500 text-white";
  if (rate >= 0.7) return "bg-sky-500 text-white";
  if (rate >= 0.6) return "bg-orange-400 text-white";
  return "bg-rose-500 text-white";
}

function daysUntilCommonTest(now: Date) {
  const diff = COMMON_TEST_START.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function localDateOnly(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function parseDueDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatDueDateLabel(value: string, now: Date): AssignmentDueStatus | null {
  const dueDate = parseDueDate(value);
  if (!dueDate) return null;

  const today = localDateOnly(now);
  const due = localDateOnly(dueDate);
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { label: "期限超過", tone: "overdue" };
  if (diffDays === 0) return { label: "本日まで", tone: "today" };
  return { label: `${dueDate.getMonth() + 1}/${dueDate.getDate()}まで`, tone: "future" };
}

export default function CommonTestDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<CourseProfile | null>(null);
  const [exams, setExams] = useState<ExamMetadata[]>([]);
  const [submissions, setSubmissions] = useState<StoredSubmission[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then((response) => (response.ok ? response.json() : { user: null })),
      fetch("/api/student-course-profile").then((response) => (response.ok ? response.json() : null)),
      fetch("/api/exams").then((response) => (response.ok ? response.json() : [])),
      fetch("/api/submissions").then((response) => (response.ok ? response.json() : [])),
      fetch("/api/assignments").then((response) => (response.ok ? response.json() : [])),
    ])
      .then(([me, profileData, examData, submissionData, assignmentData]) => {
        setUser(me.user ?? null);
        setProfile(profileData);
        setExams(Array.isArray(examData) ? examData : []);
        setSubmissions(Array.isArray(submissionData) ? submissionData : []);
        setAssignments(Array.isArray(assignmentData) ? assignmentData : []);
      })
      .catch(() => {
        setUser(null);
        setProfile(null);
        setExams([]);
        setSubmissions([]);
        setAssignments([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const commonExams = useMemo(
    () => exams.filter((exam) => exam.exam_type === "common" || normalizeExamId(exam.id).startsWith("common/")),
    [exams],
  );

  const examById = useMemo(() => new Map(commonExams.map((exam) => [normalizeExamId(exam.id), exam])), [commonExams]);

  const assignmentByExam = useMemo(() => {
    const map = new Map<string, Assignment>();
    assignments.forEach((assignment) => {
      const key = normalizeExamId(assignment.examId);
      const current = map.get(key);
      if (!current || assignment.dueDate < current.dueDate) {
        map.set(key, assignment);
      }
    });
    return map;
  }, [assignments]);

  const latestSubmissionByExam = useMemo(() => {
    const map = new Map<string, StoredSubmission>();
    submissions.filter((submission) => !getMainExamIdFromReinforcement(submission.examId)).forEach((submission) => {
      const key = normalizeExamId(submission.examId);
      const current = map.get(key);
      if (!current || new Date(submission.timestamp).getTime() > new Date(current.timestamp).getTime()) {
        map.set(key, submission);
      }
    });
    return map;
  }, [submissions]);

  const attemptCountByExam = useMemo(() => {
    const map = new Map<string, number>();
    submissions.filter((submission) => !getMainExamIdFromReinforcement(submission.examId)).forEach((submission) => {
      const key = normalizeExamId(submission.examId);
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return map;
  }, [submissions]);

  const attemptHistoryByExam = useMemo(() => {
    const map = new Map<string, StoredSubmission[]>();
    submissions.filter((submission) => !getMainExamIdFromReinforcement(submission.examId)).forEach((submission) => {
      const key = normalizeExamId(submission.examId);
      const current = map.get(key) ?? [];
      current.push(submission);
      map.set(key, current);
    });
    map.forEach((items) => items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
    return map;
  }, [submissions]);

  const reinforcementCountByMainExam = useMemo(() => {
    const map = new Map<string, number>();
    submissions.forEach((submission) => {
      if (submission.status !== "graded") return;
      const mainExamId = getMainExamIdFromReinforcement(submission.examId);
      if (!mainExamId) return;
      map.set(mainExamId, (map.get(mainExamId) ?? 0) + 1);
    });
    return map;
  }, [submissions]);

  const commonSubmissions = useMemo(
    () =>
      submissions
        .filter((submission) => examById.has(normalizeExamId(submission.examId)) && !getMainExamIdFromReinforcement(submission.examId))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [examById, submissions],
  );

  const subjectStats = useMemo(() => {
    const stats = new Map<string, { label: string; count: number; totalRate: number }>();
    commonSubmissions.forEach((submission) => {
      const exam = examById.get(normalizeExamId(submission.examId));
      if (!exam || typeof submission.score !== "number" || !submission.maxScore) return;
      const meta = getSubjectMeta(exam.subject);
      const key = getSubjectKey(exam.subject);
      const current = stats.get(key) ?? { label: meta?.label ?? exam.subject, count: 0, totalRate: 0 };
      current.count += 1;
      current.totalRate += Math.round((submission.score / submission.maxScore) * 100);
      stats.set(key, current);
    });
    return [...stats.entries()].map(([key, value]) => ({
      key,
      label: value.label,
      count: value.count,
      averageRate: value.count > 0 ? Math.round(value.totalRate / value.count) : 0,
    }));
  }, [commonSubmissions, examById]);

  const years = useMemo(() => {
    const found = Array.from(new Set(commonExams.map((exam) => exam.year))).sort((a, b) => b - a);
    return found.slice(0, 5);
  }, [commonExams]);

  const examByYearSubject = useMemo(() => {
    const map = new Map<string, ExamMetadata>();
    commonExams.forEach((exam) => {
      const subject = getSubjectMeta(exam.subject);
      if (!subject) return;
      const key = `${exam.year}:${subject.slug}`;
      if (!map.has(key)) map.set(key, exam);
    });
    return map;
  }, [commonExams]);

  const targetRate = profile?.goal?.targetRate ?? null;
  const targetScore = typeof targetRate === "number" ? Math.round((targetRate / 100) * UNWEIGHTED_TOTAL) : null;
  const latestSubmission = commonSubmissions[0] ?? null;
  const latestExam = latestSubmission ? examById.get(normalizeExamId(latestSubmission.examId)) ?? null : null;
  const countdownDays = daysUntilCommonTest(now);

  if (loading) {
    return (
      <div className="grid min-h-[60vh] place-items-center text-white">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-blue-300" />
      </div>
    );
  }

  return (
    <div className="common-map-shell min-h-screen text-white">
      <div className="lg:flex">
        <DashboardSidebar
          user={user}
          profile={profile}
          targetRate={targetRate}
          targetScore={targetScore}
          subjectStats={subjectStats}
          history={commonSubmissions.slice(0, 8)}
          examById={examById}
        />
        <main className="common-map-main min-w-0 flex-1 rounded-tl-[18px] px-4 py-6 lg:px-8">
          <div className="mx-auto max-w-[1320px] space-y-5">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,520px)] xl:items-center">
              <div>
                <div className="flex items-center gap-3">
                  <MapIcon className="h-9 w-9 text-cyan-300" />
                  <h1 className="common-map-title text-3xl font-black tracking-[0.02em] md:text-4xl">共通テスト過去問対策マップ</h1>
                </div>
                <p className="mt-3 text-base font-bold text-blue-100/82">
                  目標得点率と演習履歴を見ながら、次に解く年度・科目を決める画面です。
                </p>
              </div>
              <CommonTestCountdownCard days={countdownDays} />
            </div>

            <DashboardCards
              exerciseCount={commonSubmissions.length}
              subjectStats={subjectStats}
              latestExam={latestExam}
              latestSubmission={latestSubmission}
            />

            <YearlyScoreTable
              years={years}
              examByYearSubject={examByYearSubject}
              latestSubmissionByExam={latestSubmissionByExam}
              attemptCountByExam={attemptCountByExam}
              attemptHistoryByExam={attemptHistoryByExam}
              reinforcementCountByExam={reinforcementCountByMainExam}
              assignmentByExam={assignmentByExam}
              now={now}
            />
          </div>
        </main>
      </div>
    </div>
  );
}

function DashboardSidebar({
  user,
  profile,
  targetRate,
  targetScore,
  subjectStats,
  history,
  examById,
}: {
  user: User | null;
  profile: CourseProfile | null;
  targetRate: number | null;
  targetScore: number | null;
  subjectStats: { key: string; label: string; count: number; averageRate: number }[];
  history: StoredSubmission[];
  examById: Map<string, ExamMetadata>;
}) {
  const goal = profile?.goal ?? null;
  const courseNames = profile?.enrollments?.map((item) => item.courseName).filter(Boolean).join(" / ") || "受講コース未取り込み";

  return (
    <aside className="common-map-sidebar px-5 py-6 text-white lg:min-h-[calc(100vh-70px)] lg:w-[400px] lg:shrink-0">
      <div className="common-map-side-panel rounded-xl p-4">
        <p className="text-sm font-bold text-cyan-100">現在のステータス</p>
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-white/8 p-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-teal-400 text-white">
            <BookMarked className="h-8 w-8" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-white/60">{user?.name ?? "生徒"}</p>
            <p className="truncate text-xl font-black">{formatGoalTitle(goal)}</p>
            <p className="mt-1 truncate text-xs font-bold text-white/55">{formatGoalDetail(goal)}</p>
          </div>
        </div>
        <p className="mt-3 truncate text-xs font-bold text-white/62">{courseNames}</p>
      </div>

      <section className="common-map-side-panel mt-6 rounded-xl p-4">
        <p className="text-sm font-bold text-cyan-50">共通テスト本番の目標</p>
        <div className="mt-3 flex items-end gap-2">
          <span className="text-4xl font-black text-cyan-300">{targetRate ?? "-"}</span>
          <span className="pb-1 text-lg font-bold text-white/70">%</span>
        </div>
        <p className="mt-2 text-sm font-black text-white">
          1000点満点換算: {targetScore === null ? "未設定" : `${targetScore} / ${UNWEIGHTED_TOTAL} 点`}
        </p>
        <p className="mt-2 text-xs font-bold leading-5 text-cyan-100/80">
          取り込み済みの志望校データにある目標得点率から算出しています。傾斜配点はかけていません。
        </p>
      </section>

      <section className="common-map-side-panel mt-6 rounded-xl p-4">
        <p className="flex items-center gap-2 text-sm font-bold text-cyan-50">
          <ClipboardList className="h-4 w-4" />
          科目別の演習状況
        </p>
        <div className="mt-3 space-y-2">
          {subjectStats.length === 0 ? (
            <p className="rounded-lg bg-white/6 px-3 py-3 text-xs font-bold text-white/65">まだ演習履歴がありません。</p>
          ) : (
            subjectStats.slice(0, 8).map((item) => (
              <div key={item.key} className="common-map-mini-row grid grid-cols-[72px_1fr_58px] items-center gap-3 rounded-lg px-3 py-2 text-xs">
                <span className="font-black text-white">{item.label}</span>
                <div className="h-2 rounded-full bg-white/12">
                  <div className="h-full rounded-full bg-cyan-400" style={{ width: `${Math.min(100, item.averageRate)}%` }} />
                </div>
                <span className="text-right font-black text-cyan-100">{item.averageRate}%</span>
                <span className="col-span-3 text-[11px] font-bold text-white/55">演習 {item.count} 回の平均得点率</span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="common-map-side-panel mt-6 rounded-xl p-4">
        <p className="flex items-center gap-2 text-sm font-bold text-cyan-50">
          <History className="h-4 w-4" />
          直近の演習履歴
        </p>
        <div className="mt-3 space-y-2">
          {history.length === 0 ? (
            <p className="rounded-lg bg-white/6 px-3 py-3 text-xs font-bold text-white/65">まだ演習履歴がありません。</p>
          ) : (
            history.map((submission) => {
              const exam = examById.get(normalizeExamId(submission.examId));
              const meta = exam ? getSubjectMeta(exam.subject) : null;
              return (
                <Link
                  key={submission.id}
                  href={exam ? analysisHref(exam) : "/results"}
                  className="common-map-mini-row grid grid-cols-[74px_1fr_62px] items-center gap-3 rounded-lg px-3 py-2 text-xs transition"
                >
                  <span className="font-bold text-white/55">{formatDate(submission.timestamp)}</span>
                  <span className="truncate font-black text-white">{exam ? `${exam.year} ${meta?.label ?? exam.subject}` : submission.examId}</span>
                  <span className="text-right font-black text-cyan-100">{submission.score ?? "-"}点</span>
                </Link>
              );
            })
          )}
        </div>
      </section>
    </aside>
  );
}

function DashboardCards({
  exerciseCount,
  subjectStats,
  latestExam,
  latestSubmission,
}: {
  exerciseCount: number;
  subjectStats: { key: string; label: string; count: number; averageRate: number }[];
  latestExam: ExamMetadata | null;
  latestSubmission: StoredSubmission | null;
}) {
  const latestRate =
    latestSubmission?.score !== undefined && latestSubmission.maxScore
      ? Math.round((latestSubmission.score / latestSubmission.maxScore) * 100)
      : null;
  const weakSubject = [...subjectStats].sort((a, b) => a.averageRate - b.averageRate)[0] ?? null;

  const cards = [
    {
      label: "総演習回数",
      value: `${exerciseCount}`,
      note: "この生徒の共通テスト提出履歴",
      icon: CheckCircle2,
      tone: "blue",
    },
    {
      label: "直近の得点率",
      value: latestRate === null ? "-" : `${latestRate}%`,
      note: latestExam ? `${latestExam.year}年度 ${getSubjectMeta(latestExam.subject)?.label ?? latestExam.subject}` : "まだ提出履歴がありません",
      icon: Clock3,
      tone: "navy",
    },
    {
      label: "平均が低い科目",
      value: weakSubject?.label ?? "-",
      note: weakSubject ? `平均 ${weakSubject.averageRate}% / 演習 ${weakSubject.count} 回` : "演習履歴がありません",
      icon: ClipboardList,
      tone: "orange",
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {cards.map((item) => {
        const Icon = item.icon;
        const tone =
          item.tone === "teal"
            ? "bg-teal-500 text-white"
            : item.tone === "orange"
              ? "bg-orange-500 text-white"
              : item.tone === "navy"
                ? "bg-blue-800 text-white"
                : "bg-blue-500 text-white";
        return (
          <article key={item.label} className="common-map-summary-card rounded-xl p-5">
            <div className="flex items-center gap-4">
              <div className={`flex h-14 w-14 items-center justify-center rounded-full ${tone}`}>
                <Icon className="h-8 w-8" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black text-blue-100/88">{item.label}</p>
                <p className="mt-2 truncate text-3xl font-black text-cyan-200">{item.value}</p>
                <p className="mt-1 truncate text-xs font-bold text-blue-100/56">{item.note}</p>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function CommonTestCountdownCard({ days }: { days: number }) {
  return (
    <article className="common-countdown-card">
      <div className="common-countdown-frame">
        <p className="common-countdown-heading">共通テスト本番まで</p>
        <div className="common-countdown-row">
          <span className="common-countdown-word">あと</span>
          <span className="common-countdown-number">{days}</span>
          <span className="common-countdown-day">日</span>
        </div>
        <p className="common-countdown-date">{COMMON_TEST_DATES_LABEL}</p>
      </div>
    </article>
  );
}

function YearlyScoreTable({
  years,
  examByYearSubject,
  latestSubmissionByExam,
  attemptCountByExam,
  attemptHistoryByExam,
  reinforcementCountByExam,
  assignmentByExam,
  now,
}: {
  years: number[];
  examByYearSubject: Map<string, ExamMetadata>;
  latestSubmissionByExam: Map<string, StoredSubmission>;
  attemptCountByExam: Map<string, number>;
  attemptHistoryByExam: Map<string, StoredSubmission[]>;
  reinforcementCountByExam: Map<string, number>;
  assignmentByExam: Map<string, Assignment>;
  now: Date;
}) {
  return (
    <section className="common-map-table-panel rounded-[18px]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#c9d9ef] bg-[#f7fbff] px-5 py-4">
        <div className="flex items-start gap-2">
          <CalendarDays className="mt-0.5 h-5 w-5 text-[#1688d8]" />
          <div>
            <h2 className="text-xl font-black text-[#17325f]">年度別得点一覧（過去5年分）</h2>
            <p className="mt-1 text-sm font-black text-[#526d92]">各科目、直近3回分の点数を表示しています。</p>
          </div>
        </div>
        <span className="rounded-lg border border-[#a9c7ee] bg-[#eaf4ff] px-3 py-2 text-sm font-black text-[#24477d] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">提出履歴連動</span>
      </div>

      <div className="overflow-x-auto p-3">
        <table className="w-full min-w-[1120px] border-separate border-spacing-0 overflow-hidden rounded-xl text-center shadow-[0_0_0_1px_rgba(132,160,195,0.68)]">
          <thead>
            <tr className="bg-[linear-gradient(180deg,#dceaf8_0%,#cbdcf0_100%)] text-[15px] text-[#132f5f]">
              <th className="border-b-2 border-r-2 border-[#9fb8d5] px-3 py-3.5 font-black">年度</th>
              <th className="border-b-2 border-r-2 border-[#9fb8d5] bg-[#d5e5f6] px-3 py-3.5 font-black">
                合計<br /><span className="text-[13px] text-[#4d678c]">提出済みのみ</span>
              </th>
              {subjectMetas.map((subject) => (
                <th key={subject.slug} className="min-w-[104px] border-b-2 border-r border-[#aac1dc] px-2.5 py-3.5 font-black">
                  {subject.label}<br /><span className="text-[13px] text-[#4d678c]">({subject.max}点)</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {years.map((year) => {
              let yearTotal = 0;
              let hasScore = false;
              const cells = subjectMetas.map((subject) => {
                const exam = examByYearSubject.get(`${year}:${subject.slug}`);
                const submission = exam ? latestSubmissionByExam.get(normalizeExamId(exam.id)) : undefined;
                const attemptCount = exam ? attemptCountByExam.get(normalizeExamId(exam.id)) ?? 0 : 0;
                const attemptHistory = exam ? attemptHistoryByExam.get(normalizeExamId(exam.id)) ?? [] : [];
                const reinforcementCount = exam ? reinforcementCountByExam.get(normalizeExamId(exam.id)) ?? 0 : 0;
                const assignment = exam ? assignmentByExam.get(normalizeExamId(exam.id)) : undefined;
                const score = submission ? normalizeScore(submission, subject.max) : null;
                const dueStatus = !submission && assignment ? formatDueDateLabel(assignment.dueDate, now) : null;
                if (score !== null) {
                  yearTotal += score;
                  hasScore = true;
                }
                return { subject, exam, submission, score, attemptCount, attemptHistory, reinforcementCount, dueStatus };
              });

              return (
                <tr key={year} className="bg-[linear-gradient(180deg,#f7fbff_0%,#eaf2fb_100%)] text-[15px] text-[#17325f] transition hover:bg-[#eef7ff]">
                  <th className="border-b border-r-2 border-[#a8bed8] bg-[#dce9f7] px-3 py-4 text-[17px] font-black">{year}</th>
                  <td className="border-b border-r-2 border-[#a8bed8] bg-[#e7f1fb] px-3 py-4">
                    <span className="text-xl font-black text-[#183765]">{hasScore ? yearTotal : "-"}</span>
                    <span className="block text-sm font-black text-[#36557f]">/ {UNWEIGHTED_TOTAL}</span>
                  </td>
                  {cells.map(({ subject, exam, submission, score, attemptCount, attemptHistory, reinforcementCount, dueStatus }) => (
                    <td key={`${year}-${subject.slug}`} className="border-b border-r border-[#bfd0e5] px-2 py-4 align-middle">
                      {!exam ? (
                        <span className="text-base font-black text-[#6f84a2]">未登録</span>
                      ) : score === null ? (
                        <div className="flex flex-col items-center gap-1.5">
                        <Link
                          href={getExamHref(exam)}
                          className="inline-flex rounded-md border border-[#8db4e3] bg-[#eef6ff] px-3.5 py-1.5 text-base font-black text-[#245184] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition hover:bg-white"
                        >
                          演習
                        </Link>
                          {reinforcementCount > 0 && (
                            <span className="rounded-full border border-yellow-300 bg-slate-950 px-2.5 py-0.5 text-xs font-black text-yellow-300 shadow-[0_4px_10px_rgba(15,23,42,0.22)]">
                              補強×{reinforcementCount}
                            </span>
                          )}
                          {dueStatus && <DueBadge status={dueStatus} />}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1">
                          <Link href={analysisHref(exam)} className="group">
                            <span className={`mx-auto block min-w-14 rounded-md px-3.5 py-1.5 text-[26px] font-black leading-none shadow-[0_6px_14px_rgba(28,93,170,0.18)] transition group-hover:-translate-y-0.5 ${scoreClass(score, subject.max)}`}>
                              {score}
                            </span>
                          </Link>
                          {attemptCount > 1 && (
                            <span className="rounded-full border border-[#8bb8e9] bg-[#eef7ff] px-2.5 py-0.5 text-xs font-black text-[#23517f] shadow-[inset_0_1px_0_rgba(255,255,255,0.86)]">
                              {attemptCount}回演習
                            </span>
                          )}
                          {attemptHistory.length > 1 && (
                            <div className="mt-1 flex max-w-[112px] flex-col gap-0.5 text-[11.5px] font-black leading-tight text-[#49668d]">
                              {attemptHistory.slice(-3).map((attempt, recentIndex) => {
                                const attemptNumber = attemptHistory.length - Math.min(attemptHistory.length, 3) + recentIndex + 1;
                                const attemptScore = normalizeScore(attempt, subject.max);
                                return (
                                  <span key={attempt.id} className={attemptNumber === attemptHistory.length ? "text-[#17325f]" : ""}>
                                    {attemptNumber}回目 {attemptScore ?? "-"}点
                                  </span>
                                );
                              })}
                            </div>
                          )}
                          {reinforcementCount > 0 && (
                            <span className="rounded-full border border-yellow-300 bg-slate-950 px-2.5 py-0.5 text-xs font-black text-yellow-300 shadow-[0_4px_10px_rgba(15,23,42,0.22)]">
                              補強×{reinforcementCount}
                            </span>
                          )}
                          <Link href={analysisHref(exam)} className="rounded-md border border-[#8bb8e9] bg-white px-3 py-1 text-sm font-black text-[#1769aa] hover:bg-[#eef7ff]">
                            分析
                          </Link>
                          <Link
                            href={getExamHref(exam)}
                            className={`inline-flex items-center gap-1 rounded-md px-3 py-1 text-sm font-black ${
                              submission?.status === "graded"
                                ? "border border-[#d4623c] bg-[#fff0e8] text-[#9a321d] hover:bg-[#ffe4d7]"
                                : "border border-[#9fc4ef] bg-[#f5fbff] text-[#2c5a8c] hover:bg-white"
                            }`}
                          >
                            <RotateCcw className="h-2.5 w-2.5" />
                            {submission?.status === "graded" ? "再挑戦" : "演習"}
                          </Link>
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-5 border-t border-[#c9d9ef] bg-[#f7fbff] px-5 py-4 text-sm font-black text-[#36557f]">
        <Legend color="bg-emerald-500" label="90%以上" />
        <Legend color="bg-blue-500" label="80%以上" />
        <Legend color="bg-sky-500" label="70%以上" />
        <Legend color="bg-orange-400" label="60%以上" />
        <Legend color="bg-rose-500" label="60%未満" />
      </div>
    </section>
  );
}

function DueBadge({ status }: { status: AssignmentDueStatus }) {
  const toneClass =
    status.tone === "overdue"
      ? "border-red-950 bg-red-700 text-white shadow-[0_5px_14px_rgba(127,29,29,0.35)]"
      : status.tone === "today"
        ? "border-amber-700 bg-amber-300 text-amber-950 shadow-[0_4px_10px_rgba(180,83,9,0.2)]"
        : "border-yellow-500 bg-yellow-300 text-yellow-950 shadow-[0_4px_10px_rgba(202,138,4,0.18)]";
  const sizeClass = status.tone === "overdue" ? "px-3 py-1 text-sm tracking-wide" : "px-3 py-1 text-xs tracking-wide";

  return (
    <span className={`inline-flex items-center rounded-full border font-black leading-none ${sizeClass} ${toneClass}`}>
      {status.label}
    </span>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-3 w-3 rounded-full ${color}`} />
      {label}
    </span>
  );
}
