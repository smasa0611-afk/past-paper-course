"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, FileText, LogIn, PlayCircle } from "lucide-react";
import type { ExamMetadata } from "@/types/exam";

type User = { id: string; name: string; role: "student" | "teacher" };
type SecondaryAccess = { subscribedTargetKeys: string[] };
type SecondaryExam = ExamMetadata & { source?: { kind?: string; note?: string } };

const YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017];
const UNIVERSITY_ORDER = ["todai", "kyodai", "nagoya", "hamamatsu_medical"];

const universityLabels: Record<string, string> = {
  todai: "東京大学",
  kyodai: "京都大学",
  nagoya: "名古屋大学",
  hamamatsu_medical: "浜松医科大学",
  secondary: "2次試験",
};

const subjectLabels: Record<string, string> = {
  english: "英語",
  math: "数学",
  japanese: "国語",
  social: "地理歴史",
  science: "理科",
  physics: "物理",
  chemistry: "化学",
  biology: "生物",
  earth_science: "地学",
  world_history: "世界史",
  japanese_history: "日本史",
  geography: "地理",
  essay: "小論文",
};

const courseLabels: Record<string, string> = {
  common: "共通",
  humanities: "文系",
  science: "理系",
  medicine: "医学科",
};

const subjectOrder = new Map(
  [
    "english",
    "math",
    "japanese",
    "physics",
    "chemistry",
    "biology",
    "earth_science",
    "world_history",
    "japanese_history",
    "geography",
    "essay",
    "social",
    "science",
  ].map(
    (subject, index) => [subject, index],
  ),
);

function normalizeExamId(examId: string) {
  return examId.replace(/\\/g, "/").trim();
}

function getUniversityLabel(examType: string) {
  return universityLabels[examType] ?? examType;
}

function getSubjectLabel(subject: string) {
  return subjectLabels[subject] ?? subject;
}

function getCourseLabel(course: string) {
  return courseLabels[course] ?? course;
}

function getExamTitle(exam: SecondaryExam) {
  const course = exam.course ? ` ${getCourseLabel(exam.course)}` : "";
  return `${getUniversityLabel(exam.exam_type)}${course} ${getSubjectLabel(exam.subject)} ${exam.year}`;
}

function sortSecondaryExams(left: SecondaryExam, right: SecondaryExam) {
  const subjectDiff = (subjectOrder.get(left.subject) ?? 99) - (subjectOrder.get(right.subject) ?? 99);
  if (subjectDiff !== 0) return subjectDiff;
  return getCourseLabel(left.course).localeCompare(getCourseLabel(right.course), "ja");
}

function groupByUniversity(exams: SecondaryExam[]) {
  return UNIVERSITY_ORDER.map((examType) => ({
    examType,
    label: getUniversityLabel(examType),
    exams: exams.filter((exam) => exam.exam_type === examType),
  })).filter((group) => group.exams.length > 0);
}

export default function SecondaryPracticePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-blue-400" />
        </div>
      }
    >
      <SecondaryPracticeContent />
    </Suspense>
  );
}

function SecondaryPracticeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [exams, setExams] = useState<SecondaryExam[]>([]);
  const [secondaryAccess, setSecondaryAccess] = useState<SecondaryAccess>({ subscribedTargetKeys: [] });
  const [loading, setLoading] = useState(true);
  const [selectedYears, setSelectedYears] = useState<Record<string, number | null>>({});

  useEffect(() => {
    const university = searchParams.get("university");
    const year = Number(searchParams.get("year"));
    if (!university || !YEARS.includes(year)) return;

    setSelectedYears((current) => ({
      ...current,
      [university]: year,
    }));
  }, [searchParams]);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then((res) => (res.ok ? res.json() : { user: null })),
      fetch("/api/exams").then((res) => (res.ok ? res.json() : [])),
      fetch("/api/secondary-access").then((res) => (res.ok ? res.json() : { subscribedTargetKeys: [] })),
    ])
      .then(([me, examData, accessData]) => {
        setUser(me.user);
        setExams(Array.isArray(examData) ? examData : []);
        setSecondaryAccess({
          subscribedTargetKeys: Array.isArray(accessData.subscribedTargetKeys) ? accessData.subscribedTargetKeys : [],
        });
      })
      .catch(() => {
        setUser(null);
        setExams([]);
        setSecondaryAccess({ subscribedTargetKeys: [] });
      })
      .finally(() => setLoading(false));
  }, []);

  const secondaryExams = useMemo(() => {
    const isTeacher = user?.role === "teacher";
    const allowedTargets = new Set(secondaryAccess.subscribedTargetKeys);
    return exams
      .filter((exam) => exam.exam_type !== "common" && normalizeExamId(exam.id).startsWith(`${exam.exam_type}/`))
      .filter((exam) => isTeacher || allowedTargets.has(exam.exam_type))
      .sort(sortSecondaryExams);
  }, [exams, secondaryAccess, user?.role]);

  const groupedExams = useMemo(() => groupByUniversity(secondaryExams), [secondaryExams]);

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
          <LogIn className="mx-auto mb-4 h-10 w-10 text-blue-400" />
          <h1 className="mb-3 text-2xl font-black text-slate-950">生徒ログインが必要です</h1>
          <p className="mb-6 text-sm leading-6 text-slate-600">
            大学別2次試験演習を開くには、生徒アカウントでログインしてください。
          </p>
          <Link href="/login" className="glass-button-primary inline-flex px-5 py-3 text-sm font-bold">
            ログインへ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="secondary-practice-shell min-h-screen text-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6 md:py-10">
        <div className="mb-6">
          <Link
            href="/practice"
            className="secondary-back-button inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold"
          >
            <ArrowLeft className="h-4 w-4" />
            演習メニューに戻る
          </Link>
        </div>

        <div className="secondary-practice-heading mb-8">
          <p className="page-eyebrow mb-3 text-sm font-bold">SECONDARY EXAM</p>
          <h1 className="page-title text-4xl font-black tracking-[0.08em] md:text-6xl">大学別 2次試験演習</h1>
          <p className="page-subtitle mt-5 max-w-4xl text-sm font-bold leading-7 md:text-base">
            大学ごとに年度を選ぶと、その年度の科目一覧が表示されます。問題PDF未配置のものは、教材研究室からPDFを受領後に差し替えます。
          </p>
        </div>

        {groupedExams.length === 0 ? (
          <div className="secondary-empty-card rounded-[24px] p-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
              <FileText className="h-6 w-6" />
            </div>
            <p className="text-lg font-black text-white">申込済みの大学別2次試験演習がありません</p>
            <p className="mt-2 text-sm leading-6 text-blue-100/72">
              大学別講座の申込状況に応じて、対象大学の年度別入口が表示されます。
            </p>
          </div>
        ) : (
          <div className="space-y-7">
            {groupedExams.map((group) => {
              const selectedYear = selectedYears[group.examType] ?? null;
              const subjects = selectedYear
                ? group.exams.filter((exam) => exam.year === selectedYear).sort(sortSecondaryExams)
                : [];

              return (
                <section key={group.examType} className="secondary-university-panel rounded-[30px] p-5">
                  <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                    <div>
                      <p className="text-xs font-black tracking-[0.22em] text-blue-200/90">UNIVERSITY</p>
                      <h2 className="mt-1 text-3xl font-black text-white">{group.label}</h2>
                    </div>
                    <p className="text-sm font-bold text-blue-100/72">{group.exams.length} 件</p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-5">
                    {YEARS.map((year) => {
                      const count = group.exams.filter((exam) => exam.year === year).length;
                      const active = selectedYear === year;
                      return (
                        <button
                          key={`${group.examType}-${year}`}
                          type="button"
                          onClick={() => {
                            setSelectedYears((current) => ({
                              ...current,
                              [group.examType]: active ? null : year,
                            }));

                            const nextPath = active
                              ? "/practice/secondary"
                              : `/practice/secondary?university=${encodeURIComponent(group.examType)}&year=${year}`;
                            router.replace(nextPath, { scroll: false });
                          }}
                          className={`secondary-year-button rounded-2xl border px-4 py-3 text-left transition hover:-translate-y-0.5 ${
                            active
                              ? "secondary-year-button-active text-white"
                              : "text-blue-50 hover:text-white"
                          }`}
                        >
                          <p className="text-lg font-black">{year}年</p>
                          <p className={`mt-1 text-xs font-bold ${active ? "text-cyan-100" : "text-blue-100/60"}`}>
                            {count > 0 ? `${count} 科目` : "準備中"}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  {selectedYear && (
                    <div className="mt-5">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="border-l-4 border-blue-400 pl-3 text-lg font-black text-white">{selectedYear}年 科目一覧</h3>
                        <p className="text-sm font-bold text-blue-100/62">{subjects.length} 件</p>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        {subjects.map((exam) => (
                          <SubjectCard key={exam.id} exam={exam} />
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SubjectCard({ exam }: { exam: SecondaryExam }) {
  const isPlaceholder = exam.source?.kind === "placeholder";

  return (
    <div className="secondary-subject-card rounded-[22px] p-4">
      <div className="mb-2 flex flex-wrap gap-2">
        <Badge>{getSubjectLabel(exam.subject)}</Badge>
        {exam.course ? <Badge>{getCourseLabel(exam.course)}</Badge> : null}
        <StatusBadge ok={!isPlaceholder} okLabel="PDF配置済み" ngLabel="PDF準備中" />
        <StatusBadge ok={Boolean(exam.hasAnswer)} okLabel="解答あり" ngLabel="解答未配置" />
      </div>
      <p className="font-black text-white">{exam.title || getExamTitle(exam)}</p>
      <p className="mt-1 text-xs text-blue-100/55">{exam.id}</p>

      <Link
        href={`/exam/${exam.id}`}
        className="secondary-open-button mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold"
      >
        <PlayCircle className="h-4 w-4" />
        開く
      </Link>
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="secondary-badge rounded-lg px-3 py-1 text-xs font-bold">{children}</span>;
}

function StatusBadge({ ok, okLabel, ngLabel }: { ok: boolean; okLabel: string; ngLabel: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1 text-xs font-bold ${
        ok ? "border-cyan-300/40 bg-cyan-400/12 text-cyan-100" : "border-amber-300/45 bg-amber-400/12 text-amber-100"
      }`}
    >
      {ok && <CheckCircle2 className="h-3.5 w-3.5" />}
      {ok ? okLabel : ngLabel}
    </span>
  );
}
