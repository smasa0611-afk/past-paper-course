"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  FlaskConical,
  FunctionSquare,
  Info,
  Landmark,
  Scale,
  TrendingUp,
  Trophy,
} from "lucide-react";
import type { ExamMetadata } from "@/types/exam";
import type { StoredSubmission } from "@/lib/submission-storage";
import type { SecondaryTargetKey } from "@/types/secondary";
import {
  calculateCommonConvertedScore,
  commonConversionSubjectMax,
  getTargetConversionConfig,
} from "@/lib/target-conversion-demo";

type User = { id: string; name: string; role: "student" | "teacher" };
type Assignment = {
  id: string;
  studentId: string;
  examId: string;
  dueDate: string;
  score?: number;
  maxScore?: number;
  submittedAt?: string;
  gradedAt?: string;
  importedAt?: string;
};
type CourseGoal = {
  university: string;
  faculty: string;
  department: string;
  method?: string;
  schedule?: string;
  targetRate?: number | null;
} | null;
type SecondaryCourse = {
  targetKey: SecondaryTargetKey;
  targetName: string;
  courseName?: string;
  goalFaculty?: string;
  goalDepartment?: string;
};
type CourseProfile = {
  goal: CourseGoal;
  enrollments?: { courseName?: string; courseCode?: string; courseCategory?: string; grade?: string; campus?: string; year?: string }[];
  hasSecondaryCourse?: boolean;
  secondaryCourses?: SecondaryCourse[];
};

type SubjectConfig = {
  slug: string;
  label: string;
  shortLabel: string;
  max: number;
  aliases: string[];
  icon: React.ReactNode;
};

type CommonSubjectConfig = {
  slug: string;
  aliases: string[];
};

type CommonConvertedScore = {
  complete: boolean;
  missingSubjects: string[];
  score: number | null;
  maxScore: number;
};

type TargetConversionScoreCard = {
  year: number;
  university: string;
  faculty: string;
  common: {
    score: number;
    maxScore: number;
  };
  secondary: {
    score: number;
    maxScore: number;
  };
  total: {
    score: number;
    maxScore: number;
  };
  admittedAverage: {
    score: number;
    maxScore: number;
  };
};

const TARGET_LABELS: Record<SecondaryTargetKey, string> = {
  todai: "東京大学",
  kyodai: "京都大学",
  nagoya: "名古屋大学",
  hamamatsu_medical: "浜松医科大学",
};

const TARGET_SHORT_LABELS: Record<SecondaryTargetKey, string> = {
  todai: "東大",
  kyodai: "京大",
  nagoya: "名大",
  hamamatsu_medical: "浜松医科大",
};

const TARGET_TOTALS: Record<SecondaryTargetKey, number> = {
  todai: 440,
  kyodai: 700,
  nagoya: 1300,
  hamamatsu_medical: 700,
};

const TARGET_ACCENTS: Record<SecondaryTargetKey, string> = {
  todai: "#6f238a",
  kyodai: "#4f238b",
  nagoya: "#174f93",
  hamamatsu_medical: "#0f766e",
};

const COMMON_SUBJECTS: CommonSubjectConfig[] = [
  { slug: "english", aliases: ["english", "english_r", "reading"] },
  { slug: "english_listening", aliases: ["english_listening", "listening"] },
  { slug: "math_ia", aliases: ["math_ia"] },
  { slug: "math_iibc", aliases: ["math_iibc", "math_iib"] },
  { slug: "japanese", aliases: ["japanese"] },
  { slug: "science_1", aliases: ["physics", "biology", "earth_science", "science_1"] },
  { slug: "science_2", aliases: ["chemistry", "science_2"] },
  { slug: "social_1", aliases: ["japanese_history", "japanese_history_b", "world_history", "world_history_b", "geography", "geography_b", "social_1"] },
  { slug: "social_2", aliases: ["public", "politics_economy", "ethics", "ethics_politics_economy", "modern_society", "social_2"] },
  { slug: "information_i", aliases: ["information_i", "information", "information_related_basics"] },
];

const TARGET_SUBJECTS: Record<SecondaryTargetKey, SubjectConfig[]> = {
  todai: [
    { slug: "english", label: "英語", shortLabel: "英語", max: 120, aliases: ["english"], icon: <BookOpen className="h-7 w-7" /> },
    { slug: "math", label: "数学", shortLabel: "数学", max: 120, aliases: ["math"], icon: <FunctionSquare className="h-7 w-7" /> },
    { slug: "japanese", label: "国語", shortLabel: "国語", max: 80, aliases: ["japanese"], icon: <BookOpen className="h-7 w-7" /> },
    { slug: "physics", label: "物理", shortLabel: "物理", max: 60, aliases: ["physics", "science"], icon: <FlaskConical className="h-7 w-7" /> },
    { slug: "chemistry", label: "化学", shortLabel: "化学", max: 60, aliases: ["chemistry", "science"], icon: <ClipboardList className="h-7 w-7" /> },
  ],
  kyodai: [
    { slug: "english", label: "英語", shortLabel: "英語", max: 150, aliases: ["english"], icon: <BookOpen className="h-7 w-7" /> },
    { slug: "math", label: "数学", shortLabel: "数学", max: 200, aliases: ["math"], icon: <FunctionSquare className="h-7 w-7" /> },
    { slug: "japanese", label: "国語", shortLabel: "国語", max: 150, aliases: ["japanese"], icon: <BookOpen className="h-7 w-7" /> },
    { slug: "science", label: "理科", shortLabel: "理科", max: 200, aliases: ["science", "physics", "chemistry", "biology"], icon: <FlaskConical className="h-7 w-7" /> },
  ],
  nagoya: [
    { slug: "english", label: "英語", shortLabel: "英語", max: 300, aliases: ["english"], icon: <BookOpen className="h-7 w-7" /> },
    { slug: "math", label: "数学", shortLabel: "数学", max: 500, aliases: ["math"], icon: <FunctionSquare className="h-7 w-7" /> },
    { slug: "physics", label: "物理", shortLabel: "物理", max: 250, aliases: ["physics", "science"], icon: <FlaskConical className="h-7 w-7" /> },
    { slug: "chemistry", label: "化学", shortLabel: "化学", max: 250, aliases: ["chemistry", "science"], icon: <ClipboardList className="h-7 w-7" /> },
  ],
  hamamatsu_medical: [
    { slug: "english", label: "英語", shortLabel: "英語", max: 200, aliases: ["english"], icon: <BookOpen className="h-7 w-7" /> },
    { slug: "math", label: "数学", shortLabel: "数学", max: 200, aliases: ["math"], icon: <FunctionSquare className="h-7 w-7" /> },
    { slug: "science", label: "理科", shortLabel: "理科", max: 300, aliases: ["science", "physics", "chemistry", "biology"], icon: <FlaskConical className="h-7 w-7" /> },
  ],
};

const TARGET_YEARS = Array.from({ length: 10 }, (_, index) => 2026 - index);
const SECONDARY_TARGET_RATE = 60;
const SECONDARY_EXAM_DATE = new Date("2027-02-25T00:00:00+09:00");
const SECONDARY_EXAM_DATE_LABEL = "2027年2月25日(木) 本番";

function normalizeExamId(examId: string) {
  return examId.replace(/^\/+/, "").replace(/\\/g, "/");
}

function getMainExamIdFromReinforcement(examId: string) {
  const normalized = normalizeExamId(examId).split("?")[0];
  if (normalized.startsWith("common_retake/")) return normalized.replace(/^common_retake\//, "common/");
  return null;
}

function getCommonSubjectConfig(subject: string) {
  return COMMON_SUBJECTS.find((item) => item.aliases.includes(subject)) ?? null;
}

function getExamHref(exam: ExamMetadata, subject?: SubjectConfig) {
  const params = subject ? `?subject=${encodeURIComponent(subject.slug)}` : "";
  return `/exam/${normalizeExamId(exam.id)}${params}`;
}

function getAnalysisHref(exam: ExamMetadata, subject?: SubjectConfig) {
  return `/secondary-analysis/${encodeURIComponent(exam.exam_type)}/${encodeURIComponent(exam.year)}/${encodeURIComponent(subject?.slug ?? exam.subject)}?course=${encodeURIComponent(exam.course ?? "")}`;
}

function isScienceGoal(profile: CourseProfile | null) {
  const text = `${profile?.goal?.faculty ?? ""} ${profile?.goal?.department ?? ""} ${profile?.secondaryCourses?.[0]?.goalFaculty ?? ""}`;
  return /理|医|工|農|薬|science|medical/i.test(text) || text.length === 0;
}

function formatDateTime(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function daysUntilSecondaryExam(now: Date) {
  const diff = SECONDARY_EXAM_DATE.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function scoreToSubjectMax(submission: StoredSubmission | undefined, subjectMax: number) {
  if (!submission || typeof submission.score !== "number") return null;
  if (submission.id.startsWith("assignment-imported-") || "importedAt" in submission) {
    return Math.round(submission.score);
  }
  if (!submission.maxScore || submission.maxScore <= 0) return Math.round(submission.score);
  return Math.round((submission.score / submission.maxScore) * subjectMax);
}

function buildCommonConvertedScore({
  target,
  year,
  commonExamByYearSubject,
  latestCommonSubmissionByExam,
}: {
  target: SecondaryTargetKey;
  year: number;
  commonExamByYearSubject: Map<string, ExamMetadata>;
  latestCommonSubmissionByExam: Map<string, StoredSubmission>;
}): CommonConvertedScore | null {
  const config = getTargetConversionConfig(target);
  if (!config) return null;

  const subjectScores: Record<string, number> = {};
  const missingSubjects = Object.keys(config.commonWeights).filter((subject) => {
    const exam = commonExamByYearSubject.get(`${year}:${subject}`);
    const max = commonConversionSubjectMax[subject];
    const submission = exam ? latestCommonSubmissionByExam.get(normalizeExamId(exam.id)) : undefined;
    const score = typeof max === "number" ? scoreToSubjectMax(submission, max) : null;
    if (score === null) return true;
    subjectScores[subject] = score;
    return false;
  });

  if (missingSubjects.length > 0) {
    return {
      complete: false,
      missingSubjects,
      score: null,
      maxScore: config.commonMaxScore,
    };
  }

  return {
    complete: true,
    missingSubjects,
    score: calculateCommonConvertedScore(subjectScores, config),
    maxScore: config.commonMaxScore,
  };
}

function buildSecondaryConvertedScore({
  year,
  examByYearSubject,
  displayedSubmissionByExam,
  subjects,
  maxScore,
}: {
  year: number;
  examByYearSubject: Map<string, ExamMetadata>;
  displayedSubmissionByExam: Map<string, StoredSubmission>;
  subjects: SubjectConfig[];
  maxScore: number;
}) {
  let score = 0;
  const missingSubjects = subjects.filter((subject) => {
    const exam = examByYearSubject.get(`${year}:${subject.slug}`);
    const submission = exam ? displayedSubmissionByExam.get(normalizeExamId(exam.id)) : undefined;
    const subjectScore = scoreToSubjectMax(submission, subject.max);
    if (subjectScore === null) return true;
    score += subjectScore;
    return false;
  });

  if (missingSubjects.length > 0) {
    return {
      complete: false,
      missingSubjects: missingSubjects.map((subject) => subject.slug),
      score: null,
      maxScore,
    };
  }

  return {
    complete: true,
    missingSubjects: [],
    score,
    maxScore,
  };
}

function buildTargetConversionScoreCards({
  target,
  profile,
  years,
  commonExamByYearSubject,
  latestCommonSubmissionByExam,
  examByYearSubject,
  displayedSubmissionByExam,
  subjects,
}: {
  target: SecondaryTargetKey;
  profile: CourseProfile | null;
  years: number[];
  commonExamByYearSubject: Map<string, ExamMetadata>;
  latestCommonSubmissionByExam: Map<string, StoredSubmission>;
  examByYearSubject: Map<string, ExamMetadata>;
  displayedSubmissionByExam: Map<string, StoredSubmission>;
  subjects: SubjectConfig[];
}) {
  const config = getTargetConversionConfig(target);
  if (!config) return [];

  return years.flatMap((year) => {
    const common = buildCommonConvertedScore({
      target,
      year,
      commonExamByYearSubject,
      latestCommonSubmissionByExam,
    });
    const secondary = buildSecondaryConvertedScore({
      year,
      examByYearSubject,
      displayedSubmissionByExam,
      subjects,
      maxScore: config.secondaryMaxScore,
    });

    if (!common?.complete || common.score === null || !secondary.complete || secondary.score === null) return [];

    const totalScore = common.score + secondary.score;
    return [
      {
        year,
        university: profile?.goal?.university || TARGET_LABELS[target],
        faculty: profile?.goal?.faculty || profile?.secondaryCourses?.[0]?.goalFaculty || "",
        common: {
          score: common.score,
          maxScore: config.commonMaxScore,
        },
        secondary: {
          score: secondary.score,
          maxScore: config.secondaryMaxScore,
        },
        total: {
          score: totalScore,
          maxScore: config.totalMaxScore,
        },
        admittedAverage: {
          score: config.admittedAverageScore,
          maxScore: config.totalMaxScore,
        },
      } satisfies TargetConversionScoreCard,
    ];
  });
}

function scoreTone(score: number, max: number) {
  const rate = max > 0 ? score / max : 0;
  if (rate >= 0.6) return "bg-emerald-500 text-white";
  if (rate >= 0.5) return "bg-blue-500 text-white";
  if (rate >= 0.45) return "bg-sky-500 text-white";
  if (rate >= 0.4) return "bg-orange-400 text-white";
  if (rate >= 0.35) return "bg-[#d9461e] text-white";
  return "bg-[#d9461e] text-white";
}

function goalTitle(profile: CourseProfile | null, target: SecondaryTargetKey) {
  const university = profile?.goal?.university || TARGET_LABELS[target];
  const faculty = profile?.goal?.faculty || profile?.secondaryCourses?.[0]?.goalFaculty || "";
  return [university, faculty].filter(Boolean).join(" ");
}

function courseTitle(profile: CourseProfile | null, target: SecondaryTargetKey) {
  return profile?.secondaryCourses?.[0]?.courseName || `${TARGET_SHORT_LABELS[target]}2次対策講座`;
}

export default function SecondaryResultsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<CourseProfile | null>(null);
  const [exams, setExams] = useState<ExamMetadata[]>([]);
  const [submissions, setSubmissions] = useState<StoredSubmission[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());

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

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const target = profile?.secondaryCourses?.[0]?.targetKey ?? null;
  const subjects = target ? TARGET_SUBJECTS[target] : [];
  const targetTotal = target ? TARGET_TOTALS[target] : 0;
  const science = isScienceGoal(profile);

  const targetExams = useMemo(() => {
    if (!target) return [];
    return exams.filter((exam) => exam.exam_type === target || normalizeExamId(exam.id).startsWith(`${target}/`));
  }, [exams, target]);

  const commonExams = useMemo(
    () => exams.filter((exam) => exam.exam_type === "common" || normalizeExamId(exam.id).startsWith("common/")),
    [exams],
  );

  const examByYearSubject = useMemo(() => {
    const map = new Map<string, ExamMetadata>();
    targetExams.forEach((exam) => {
      subjects.forEach((subject) => {
        if (!subject.aliases.includes(exam.subject)) return;
        const key = `${exam.year}:${subject.slug}`;
        const existing = map.get(key);
        if (!existing) {
          map.set(key, exam);
          return;
        }
        if (science && exam.course === "science") map.set(key, exam);
        if (!science && exam.course === "humanities") map.set(key, exam);
      });
    });
    return map;
  }, [science, subjects, targetExams]);

  const commonExamByYearSubject = useMemo(() => {
    const map = new Map<string, ExamMetadata>();
    commonExams.forEach((exam) => {
      const subject = getCommonSubjectConfig(exam.subject);
      if (!subject) return;
      const key = `${exam.year}:${subject.slug}`;
      if (!map.has(key)) map.set(key, exam);
    });
    return map;
  }, [commonExams]);

  const allSubmissions = useMemo(() => {
    const importedAssignments = assignments
      .filter((assignment) => typeof assignment.score === "number")
      .map((assignment) => ({
        id: `assignment-imported-${assignment.id}`,
        examId: assignment.examId,
        studentId: assignment.studentId,
        content: "Imported secondary score attached to assignment.",
        images: [],
        timestamp: assignment.submittedAt || assignment.importedAt || assignment.dueDate || new Date().toISOString(),
        status: "graded",
        score: assignment.score,
        maxScore: assignment.maxScore || 100,
        feedback: "Imported from secondary score CSV.",
        gradedAt: assignment.gradedAt,
        importedAt: assignment.importedAt,
      }) satisfies StoredSubmission);

    return [...submissions, ...importedAssignments];
  }, [assignments, submissions]);

  const latestSubmissionByExam = useMemo(() => {
    const map = new Map<string, StoredSubmission>();
    allSubmissions.forEach((submission) => {
      const key = normalizeExamId(submission.examId);
      const current = map.get(key);
      if (!current || new Date(submission.timestamp).getTime() > new Date(current.timestamp).getTime()) {
        map.set(key, submission);
      }
    });
    return map;
  }, [allSubmissions]);

  const latestCommonSubmissionByExam = useMemo(() => {
    const commonExamIds = new Set(commonExams.map((exam) => normalizeExamId(exam.id)));
    const map = new Map<string, StoredSubmission>();
    allSubmissions
      .filter((submission) => commonExamIds.has(normalizeExamId(submission.examId)) && !getMainExamIdFromReinforcement(submission.examId))
      .forEach((submission) => {
        const key = normalizeExamId(submission.examId);
        const current = map.get(key);
        if (!current || new Date(submission.timestamp).getTime() > new Date(current.timestamp).getTime()) {
          map.set(key, submission);
        }
      });
    return map;
  }, [allSubmissions, commonExams]);

  const displayedSubmissionByExam = useMemo(() => {
    return latestSubmissionByExam;
  }, [latestSubmissionByExam]);

  const secondarySubmissions = useMemo(
    () =>
      allSubmissions
        .filter((submission) => targetExams.some((exam) => normalizeExamId(exam.id) === normalizeExamId(submission.examId)))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [allSubmissions, targetExams],
  );

  const targetConversionScores = useMemo(() => {
    if (!target) return [];
    return buildTargetConversionScoreCards({
      target,
      profile,
      years: TARGET_YEARS,
      commonExamByYearSubject,
      latestCommonSubmissionByExam,
      examByYearSubject,
      displayedSubmissionByExam,
      subjects,
    });
  }, [
    commonExamByYearSubject,
    displayedSubmissionByExam,
    examByYearSubject,
    latestCommonSubmissionByExam,
    profile,
    subjects,
    target,
  ]);

  const subjectStats = useMemo(() => {
    return subjects.map((subject) => {
      const values: number[] = [];
      TARGET_YEARS.forEach((year) => {
        const exam = examByYearSubject.get(`${year}:${subject.slug}`);
        const submission = exam ? displayedSubmissionByExam.get(normalizeExamId(exam.id)) : undefined;
        const score = scoreToSubjectMax(submission, subject.max);
        if (score !== null) values.push(Math.round((score / subject.max) * 100));
      });
      const averageRate = values.length > 0 ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
      return { ...subject, count: values.length, averageRate };
    });
  }, [displayedSubmissionByExam, examByYearSubject, subjects]);

  const latestSubmission = secondarySubmissions[0] ?? null;
  const latestExam = latestSubmission
    ? targetExams.find((exam) => normalizeExamId(exam.id) === normalizeExamId(latestSubmission.examId)) ?? null
    : null;
  const exerciseCount = secondarySubmissions.length;
  const bestSubject = [...subjectStats].filter((item) => item.count > 0).sort((a, b) => b.averageRate - a.averageRate)[0] ?? null;
  const latestYearTotal = subjects.reduce((sum, subject) => {
    const exam = examByYearSubject.get(`2026:${subject.slug}`);
    const submission = exam ? displayedSubmissionByExam.get(normalizeExamId(exam.id)) : undefined;
    return sum + (scoreToSubjectMax(submission, subject.max) ?? 0);
  }, 0);
  const latestYearRate = targetTotal > 0 && latestYearTotal > 0 ? Math.round((latestYearTotal / targetTotal) * 100) : null;
  const targetRate = SECONDARY_TARGET_RATE;
  const targetScore = Math.round((targetRate / 100) * targetTotal);
  const countdownDays = daysUntilSecondaryExam(now);
  if (loading) {
    return (
      <div className="grid min-h-[60vh] place-items-center text-white">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-purple-300" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="grid min-h-[70vh] place-items-center px-6 text-white">
        <div className="max-w-md rounded-2xl border border-white/14 bg-white/10 p-8 text-center backdrop-blur">
          <Landmark className="mx-auto mb-4 h-10 w-10 text-purple-200" />
          <h1 className="text-2xl font-black">ログインが必要です</h1>
          <p className="mt-3 text-sm font-bold text-white/70">2次過去問演習マップを見るにはログインしてください。</p>
          <Link href="/login" className="mt-6 inline-flex rounded-xl bg-purple-600 px-5 py-3 text-sm font-black text-white">
            ログインへ
          </Link>
        </div>
      </div>
    );
  }

  if (!target) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#352161,#130d28_55%,#080517_100%)] px-6 py-10 text-white">
        <div className="mx-auto max-w-3xl rounded-3xl border border-white/14 bg-white/10 p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur">
          <Landmark className="mx-auto mb-4 h-12 w-12 text-amber-200" />
          <h1 className="text-3xl font-black">2次過去問演習マップは未申込です</h1>
          <p className="mt-4 text-sm font-bold leading-7 text-white/74">
            東大・京大・名大・浜松医科大の大学別2次対策講座を申し込んだ生徒のみ表示されます。
          </p>
          <Link href="/results" className="mt-6 inline-flex rounded-xl border border-white/18 bg-white/12 px-5 py-3 text-sm font-black text-white">
            共通テスト演習マップへ
          </Link>
        </div>
      </div>
    );
  }

  const accent = TARGET_ACCENTS[target];

  return (
    <div className="secondary-map-shell min-h-screen text-[#fff1cd]">
      <div className="secondary-map-stage relative overflow-hidden">
        <div className="secondary-map-light pointer-events-none absolute inset-0" />
        <div className="relative lg:flex">
          <aside className="secondary-map-sidebar px-4 py-4 lg:min-h-[calc(100vh-70px)] lg:w-[360px] lg:shrink-0">
            <section className="secondary-map-side-panel rounded-xl p-4">
              <p className="rounded-t-lg bg-[linear-gradient(90deg,#f06700,#b44600)] px-3 py-2 text-lg font-black text-white">現在のステータス</p>
              <div className="secondary-map-profile mt-4 flex items-center gap-4 rounded-xl p-4">
                <div className="secondary-map-profile-icon flex h-16 w-16 items-center justify-center rounded-full">
                  <Landmark className="h-10 w-10" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black text-[#d9b978]">{user.name}</p>
                  <p className="truncate text-xl font-black text-[#fff6dd]">{goalTitle(profile, target)}</p>
                  <span className="secondary-map-course-pill mt-2 inline-flex rounded-md px-2 py-1 text-xs font-black">{courseTitle(profile, target)}</span>
                </div>
              </div>
            </section>

            <section className="secondary-map-side-panel mt-4 rounded-xl p-4">
              <p className="text-base font-black">2次試験の目標</p>
              <div className="mt-3 flex items-end gap-1">
                <span className="secondary-map-gold-number text-4xl font-black">{targetRate.toFixed(1)}</span>
                <span className="pb-1 text-xl font-black text-[#fff0c7]">%</span>
              </div>
              <p className="mt-2 text-sm font-black">目標得点：{targetScore} / {targetTotal} 点</p>
              <p className="mt-1 text-xs font-bold">大学別2次の配点ベース</p>
            </section>

            <section className="secondary-map-side-panel mt-4 rounded-xl p-4">
              <p className="mb-3 text-base font-black">科目別の演習状況</p>
              <div className="space-y-3">
                {subjectStats.map((item) => (
                  <div key={item.slug} className="grid grid-cols-[36px_1fr_48px] items-center gap-3">
                    <div className="text-[#f6c46d]">{item.icon}</div>
                    <div>
                      <div className="flex items-center justify-between text-sm font-black">
                        <span>{item.label}</span>
                        <span>{item.averageRate}%</span>
                      </div>
                      <div className="secondary-map-progress mt-1 h-2 rounded-full">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, item.averageRate)}%` }} />
                      </div>
                      <p className="mt-1 text-[11px] font-bold">演習 {item.count} 回の平均得点率</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="secondary-map-side-panel mt-4 rounded-xl p-4 text-sm font-bold leading-6 text-[#d6c7e8]">
              <div className="flex gap-2">
                <Info className="mt-0.5 h-5 w-5 shrink-0" />
                <p>得点は添削済みの提出結果から集計しています。</p>
              </div>
            </section>
          </aside>

          <main className="min-w-0 flex-1 p-4 lg:p-6">
            <div className="secondary-map-main-panel mx-auto max-w-[1380px] rounded-xl p-4 md:p-6">
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(390px,520px)] xl:items-center">
                <div>
                  <div className="flex items-center gap-4">
                    <BookOpen className="h-9 w-9 text-[#f0c06f]" />
                    <div>
                      <h1 className="secondary-map-title text-3xl font-black tracking-[0.02em] md:text-4xl">
                        {goalTitle(profile, target)} 2次試験演習マップ
                      </h1>
                      <p className="mt-3 text-sm font-bold leading-7 text-[#d7c9e6]">
                        合格結果の点数をもとに、10年分の演習状況と得点推移を確認できます。
                      </p>
                    </div>
                  </div>
                </div>
                <div className="grid gap-4">
                  <SecondaryCountdownCard days={countdownDays} targetName={TARGET_SHORT_LABELS[target]} />
                </div>
                <article className="hidden rounded-xl border border-[#bda9df] bg-white/72 p-5 shadow-[0_14px_34px_rgba(61,24,91,0.12)]">
                  <p className="text-sm font-black text-[#392253]">直近の演習</p>
                  <p className="mt-2 truncate text-2xl font-black text-[#2b1745]">
                    {latestExam ? `${latestExam.year}年度 ${latestExam.title.replace(TARGET_LABELS[target], "").trim()}` : "まだ演習履歴がありません"}
                  </p>
                  <p className="mt-2 text-sm font-bold text-[#58496d]">
                    {latestSubmission ? `${formatDateTime(latestSubmission.timestamp)} / ${latestSubmission.score ?? "-"} 点` : "演習を始めるとここに表示されます"}
                  </p>
                </article>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <SummaryCard icon={<CheckCircle2 className="h-9 w-9" />} label="2次演習実施数" value={`${exerciseCount}`} note="過去10年分の演習回数" accent={accent} />
                <SummaryCard icon={<Clock3 className="h-9 w-9" />} label="直近の合計得点率" value={latestYearRate === null ? "-" : `${latestYearRate}%`} note="2026年度" accent={accent} />
                <SummaryCard icon={<ClipboardList className="h-9 w-9" />} label="平均が高い科目" value={bestSubject?.label ?? "-"} note={bestSubject ? `平均 ${bestSubject.averageRate}% / 演習 ${bestSubject.count} 回` : "演習履歴なし"} accent={accent} />
                <SummaryCard icon={<CalendarDays className="h-9 w-9" />} label="直近の演習" value={latestExam ? `${latestExam.year}年度` : "-"} note={latestExam?.title ?? "未実施"} accent={accent} />
              </div>

              {targetConversionScores.length > 0 && (
                <div className="mt-5 space-y-3">
                  {targetConversionScores.map((score) => (
                    <TargetConversionScorePanel key={score.year} score={score} />
                  ))}
                </div>
              )}

              <section className="secondary-map-table-panel mt-5 rounded-[18px]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d9c9b2] bg-[#fffaf2] px-5 py-4">
                  <div className="flex items-center gap-3">
                    <BarChart3 className="h-6 w-6 text-[#b57a24]" />
                    <h2 className="text-xl font-black text-[#29173f]">年度別得点一覧（過去10年）</h2>
                  </div>
                  <span className="text-sm font-black text-[#57456d]">添削済み結果を表示</span>
                </div>

                <div className="overflow-x-auto p-3">
                  <table className="w-full min-w-[1040px] border-separate border-spacing-0 overflow-hidden rounded-xl text-center shadow-[0_0_0_1px_rgba(207,189,164,0.68)]">
                    <thead>
                      <tr className="bg-[linear-gradient(180deg,#fff7eb_0%,#efe3d2_100%)] text-sm text-[#23172f]">
                        <th className="border-b border-r border-[#d8c7b0] px-4 py-4 font-black">年度</th>
                        <th className="border-b border-r border-[#d8c7b0] px-4 py-4 font-black">合計<br /><span className="text-[13px] text-[#6c5a47]">/ {targetTotal}</span></th>
                        {subjects.map((subject) => (
                          <th key={subject.slug} className="border-b border-r border-[#d8c7b0] px-4 py-4 font-black">
                            {subject.label}<br /><span className="text-[13px] text-[#6c5a47]">/ {subject.max}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {TARGET_YEARS.map((year) => {
                        let total = 0;
                        let hasScore = false;
                        const cells = subjects.map((subject) => {
                          const exam = examByYearSubject.get(`${year}:${subject.slug}`);
                          const submission = exam ? displayedSubmissionByExam.get(normalizeExamId(exam.id)) : undefined;
                          const score = scoreToSubjectMax(submission, subject.max);
                          if (score !== null) {
                            total += score;
                            hasScore = true;
                          }
                          return { subject, exam, submission, score };
                        });

                        return (
                          <tr key={year} className="bg-[linear-gradient(180deg,#fffaf2_0%,#f2eadf_100%)] text-sm text-[#251b2f] hover:bg-[#fff6e8]">
                            <th className="border-b border-r border-[#ddcdb8] bg-[#f2e4cf] px-4 py-4 text-lg font-black text-[#241830]">{year}</th>
                            <td className="border-b border-r border-[#ddcdb8] bg-[#f7ecdd] px-4 py-4">
                              <span className={hasScore ? `rounded-md px-3 py-1.5 text-base font-black shadow-[0_6px_16px_rgba(91,121,45,0.2)] ${scoreTone(total, targetTotal)}` : "text-base font-black text-[#7c6b59]"}>
                                {hasScore ? total : "未取込"}
                              </span>
                              {hasScore && <span className="ml-2 text-base font-black text-[#251b2f]">/ {targetTotal}</span>}
                            </td>
                            {cells.map(({ subject, exam, score }) => (
                              <td key={`${year}-${subject.slug}`} className="border-b border-r border-[#ddcdb8] px-3 py-4">
                                {!exam ? (
                                  <span className="text-sm font-black text-[#8a7b6a]">未登録</span>
                                ) : score === null ? (
                                  <Link href={getExamHref(exam, subject)} className="inline-flex rounded-md border border-[#b99568] bg-[#fff8ee] px-3 py-1.5 text-sm font-black text-[#4b3420] shadow-[inset_0_1px_0_rgba(255,255,255,0.88)] hover:bg-white">
                                    演習
                                  </Link>
                                ) : (
                                  <div className="flex flex-wrap items-center justify-center gap-2">
                                    <Link
                                      href={getAnalysisHref(exam, subject)}
                                      className={`min-w-11 rounded-md px-3 py-1.5 text-base font-black shadow-[0_6px_16px_rgba(110,73,33,0.16)] transition hover:-translate-y-0.5 hover:brightness-110 ${scoreTone(score, subject.max)}`}
                                      title={`${year}年度 ${subject.label}の入試分析レポートを開く`}
                                    >
                                      {score}
                                    </Link>
                                    <span className="text-base font-black text-[#251b2f]">/ {subject.max}</span>
                                    <Link href={getExamHref(exam, subject)} className="rounded-md border border-[#d4623c] bg-[#fff0e8] px-2.5 py-1 text-sm font-black text-[#9a321d] hover:bg-[#ffe4d7]">
                                      再挑戦
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
                <div className="flex flex-wrap items-center gap-5 border-t border-[#d9c9b2] bg-[#fffaf2] px-5 py-4 text-sm font-black text-[#57456d]">
                  <ScoreLegend color="bg-emerald-500" label="60%以上" />
                  <ScoreLegend color="bg-blue-500" label="50%以上" />
                  <ScoreLegend color="bg-sky-500" label="45%以上" />
                  <ScoreLegend color="bg-orange-400" label="40%以上" />
                  <ScoreLegend color="bg-[#d9461e]" label="35%以上" />
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function ScoreLegend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-3 w-3 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function TargetConversionScorePanel({ score }: { score: TargetConversionScoreCard }) {
  const gapToAverage = Math.max(0, Math.ceil(score.admittedAverage.score - score.total.score));

  return (
    <section className="secondary-map-summary-card mt-5 overflow-hidden rounded-xl px-6 py-4 sm:px-8 2xl:pl-14 2xl:pr-6">
      <div className="grid gap-4 2xl:grid-cols-[minmax(300px,0.62fr)_minmax(0,1.38fr)] 2xl:items-center">
        <div className="min-w-0 2xl:pl-5">
          <div className="flex items-center gap-2.5">
            <div className="secondary-map-summary-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#ffe7ad]">
              <Scale className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[0.65rem] font-black tracking-[0.2em] text-[#f3c877]">TARGET CONVERSION</p>
              <h2 className="mt-1 text-[clamp(1rem,1.08vw,1.2rem)] font-black leading-snug text-[#fff6dd]">
                <span className="block">{score.year}年度 {score.university} {score.faculty}</span>
                <span className="block">総合換算スコア</span>
              </h2>
            </div>
          </div>
          <p className="mt-3 pl-[3.375rem] text-xs font-bold leading-5 text-[#d7c9e6]">共通テスト演習と2次試験演習を志望大配点に換算</p>
        </div>

        <div className="grid min-w-0 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:w-[min(100%,700px)] 2xl:justify-self-start">
          <TargetConversionMetric label="共通テスト換算" value={score.common.score} max={score.common.maxScore} />
          <TargetConversionMetric label="2次試験" value={score.secondary.score} max={score.secondary.maxScore} />
          <TargetConversionMetric label="総合" value={score.total.score} max={score.total.maxScore} emphasis />
          <TargetConversionMetric label="合格者平均" value={score.admittedAverage.score} max={score.admittedAverage.maxScore} />
          <div className="min-w-0 rounded-lg border border-[#d89b58]/60 bg-[#4a2b33]/72 px-2.5 py-3">
            <p className="flex items-center gap-1.5 text-xs font-black text-[#ffe1b3]">
              <TrendingUp className="h-4 w-4" />
              平均まで
            </p>
            <p className="mt-2 text-[clamp(1.25rem,1.55vw,1.55rem)] font-black leading-none text-[#ffe2a3]">
              あと{gapToAverage}
              <span className="mt-1 block text-sm leading-none">点</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function TargetConversionMetric({
  label,
  value,
  max,
  emphasis = false,
}: {
  label: string;
  value: number;
  max: number;
  emphasis?: boolean;
}) {
  const formattedValue = Number.isInteger(value) ? value.toString() : value.toFixed(1);
  const formattedMax = Number.isInteger(max) ? max.toString() : max.toFixed(1);

  return (
    <div className={`min-w-0 rounded-lg border px-2.5 py-3 ${emphasis ? "border-[#f0c06f]/70 bg-[#2e5a72]/52" : "border-[#bda9df]/35 bg-white/8"}`}>
      <p className="text-xs font-black leading-snug text-[#d9c8e7]">{label}</p>
      <p className={`mt-2 font-black leading-none ${emphasis ? "text-[clamp(1.55rem,1.95vw,1.9rem)] text-[#a8efff]" : "text-[clamp(1.3rem,1.6vw,1.55rem)] text-[#fff6dd]"}`}>
        {formattedValue}
        <span className="mt-1 block text-xs leading-none text-[#b9a9cc]">/ {formattedMax}</span>
      </p>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  note,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
  accent: string;
}) {
  return (
    <article className="secondary-map-summary-card rounded-xl p-5">
      <div className="flex items-center gap-4">
        <div className="secondary-map-summary-icon flex h-14 w-14 items-center justify-center rounded-full text-[#ffe7ad]" style={{ borderColor: accent }}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black text-[#d9c8e7]">{label}</p>
          <p className="mt-1 truncate text-3xl font-black text-[#ffe2a3]">{value}</p>
          <p className="mt-1 truncate text-xs font-bold text-[#b9a9cc]">{note}</p>
        </div>
      </div>
    </article>
  );
}

function SecondaryCountdownCard({ days, targetName }: { days: number; targetName: string }) {
  return (
    <article className="secondary-countdown-card">
      <div className="secondary-countdown-frame">
        <p className="secondary-countdown-heading">{targetName} 2次試験まで</p>
        <div className="secondary-countdown-row">
          <span className="secondary-countdown-word">あと</span>
          <span className="secondary-countdown-number">{days}</span>
          <span className="secondary-countdown-day">日</span>
        </div>
        <p className="secondary-countdown-date">{SECONDARY_EXAM_DATE_LABEL}</p>
      </div>
    </article>
  );
}
