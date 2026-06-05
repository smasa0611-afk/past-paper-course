"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Grid2X2,
  Home,
  Info,
  Lightbulb,
  ListChecks,
  Loader2,
  PencilLine,
  RotateCcw,
  Star,
  Target,
  TrendingUp,
  XCircle,
} from "lucide-react";
import type { ExamMetadata, MarksheetQuestion, MarksheetSchema } from "@/types/exam";
import type { StudentGoal } from "@/types/admissions";
import {
  buildEffectiveScoringRules,
  getAwardedPoints,
  getDisplayCorrectAnswers,
  matchesScoringRule,
  parseMarksheetSubmission,
  resolveSelectedSectionIds as resolveMarksheetSelectedSectionIds,
  type MarksheetSubmissionPayload,
} from "@/lib/marksheet-scoring";
import sectionThemeMaster from "@/generated/section-themes.json";
import AppHeader from "./AppHeader";

type User = { id: string; name: string; role: "student" | "teacher" };
type Submission = {
  id: string;
  examId: string;
  studentId: string;
  content: string;
  timestamp: string;
  status: string;
  score?: number;
  maxScore?: number;
  feedback?: string;
  gradedAt?: string;
};
type QuestionAnalysis = {
  id: string;
  displayLabel: string;
  content: string;
  points: number;
  selectedAnswer: string;
  correctAnswer: string;
  result: "correct" | "partial" | "wrong" | "unanswered";
  memo: string;
  sectionKey: string;
};
type SectionAnalysis = {
  key: string;
  title: string;
  score: number;
  maxScore: number;
  questions: QuestionAnalysis[];
};
type AttemptAnalysis = {
  submission: Submission;
  index: number;
  payload: MarksheetSubmissionPayload | null;
  sections: SectionAnalysis[];
  score: number;
  maxScore: number;
  rate: number;
};
type SectionTone = "teal" | "blue" | "orange" | "red" | "slate";
type SectionThemeEntry = {
  year: number;
  subject: string;
  sectionTitle: string;
  themes: { branch?: string; theme: string }[];
  sourceName?: string;
  sourceUrl?: string;
  points?: number | null;
};

const subjectLabels: Record<string, string> = {
  english: "英語R",
  english_listening: "英語L",
  math_ia: "数学IA",
  math_iibc: "数学IIBC",
  japanese: "国語",
  physics: "物理",
  chemistry: "化学",
  biology: "生物",
  japanese_history: "日本史",
  world_history: "世界史",
  geography: "地理",
  public_politics_economy: "公共・政治経済",
  information_i: "情報I",
};

const DISPLAYED_ATTEMPT_LIMIT = 5;

function examHref(year: string, subject: string, answer = false) {
  return `/exam/common/${year}/${subject}${answer ? "?pdf=answer.pdf" : ""}`;
}

function reinforcementExamId(year: string, subject: string) {
  return `common_retake/${year}/${subject}`;
}

function reinforcementExamHref(year: string, subject: string) {
  return `/exam/${reinforcementExamId(year, subject)}`;
}

function resolveSelectedSectionIds(schema: MarksheetSchema, payload: MarksheetSubmissionPayload | null) {
  return resolveMarksheetSelectedSectionIds(schema, payload?.selectedSectionIds ?? []);
}

function getQuestionSection(question: MarksheetQuestion, index: number) {
  const title = question.sectionTitle || question.prompt?.match(/^第\d+問[^：:、。]*/)?.[0] || `第${Math.floor(index / 6) + 1}問`;
  return {
    key: question.sectionId || title,
    title,
  };
}

function buildAnalysis(schema: MarksheetSchema, payload: MarksheetSubmissionPayload | null): SectionAnalysis[] {
  const answers = payload?.answers ?? {};
  const selectedSectionIds = resolveSelectedSectionIds(schema, payload);
  const selectableSectionIds = new Set(schema.selectionGroups?.flatMap((group) => group.sectionIds) ?? []);
  const activeQuestions = schema.questions.filter(
    (question) =>
      !question.sectionId ||
      !selectableSectionIds.has(question.sectionId) ||
      selectedSectionIds.has(question.sectionId),
  );
  const activeQuestionIds = new Set(activeQuestions.map((question) => question.id));
  const questionsById = new Map(schema.questions.map((question, index) => [question.id, { question, index }]));
  const questionAnalyses = new Map<string, QuestionAnalysis>();
  const sectionScores = new Map<string, { score: number; maxScore: number }>();

  activeQuestions.forEach((question, index) => {
    const section = getQuestionSection(question, index);
    questionAnalyses.set(question.id, {
      id: question.id,
      displayLabel: question.displayLabel ?? String(question.number),
      content: question.prompt || question.sectionTitle || "設問",
      points: question.points ?? 0,
      selectedAnswer: answers[question.id] ?? "-",
      correctAnswer: String(question.correctAnswer ?? "-"),
      result: answers[question.id] ? "wrong" : "unanswered",
      memo: answers[question.id] ? "見直し対象" : "未入力",
      sectionKey: section.key,
    });
    if (!sectionScores.has(section.key)) sectionScores.set(section.key, { score: 0, maxScore: 0 });
  });

  buildEffectiveScoringRules(schema)
    .filter((rule) => rule.questionIds.every((questionId) => activeQuestionIds.has(questionId)))
    .forEach((rule) => {
      const first = questionsById.get(rule.questionIds[0]);
      if (!first) return;
      const section = rule.sectionId
        ? { key: rule.sectionId, title: first.question.sectionTitle || rule.title || rule.sectionId }
        : getQuestionSection(first.question, first.index);
      const actual = rule.questionIds.map((questionId) => answers[questionId] ?? "");
      const prerequisitesMet = (rule.requires ?? []).every((requirement) => answers[requirement.questionId] === requirement.value);
      const fullyMatched = prerequisitesMet && matchesScoringRule(rule, actual);
      const awarded = prerequisitesMet ? getAwardedPoints(rule, actual) : 0;
      const displayCorrectAnswers = getDisplayCorrectAnswers(rule, actual);
      const score = sectionScores.get(section.key) ?? { score: 0, maxScore: 0 };
      score.score += awarded;
      score.maxScore += rule.points;
      sectionScores.set(section.key, score);

      rule.questionIds.forEach((questionId, index) => {
        const current = questionAnalyses.get(questionId);
        if (!current) return;
        const correctAnswer = displayCorrectAnswers[index] ?? current.correctAnswer;
        const selectedAnswer = answers[questionId] ?? "-";
        current.correctAnswer = correctAnswer;
        current.points = Math.max(current.points, rule.questionIds.length === 1 ? rule.points : Math.round(rule.points / rule.questionIds.length));
        current.selectedAnswer = selectedAnswer;
        current.result = !answers[questionId] ? "unanswered" : fullyMatched ? "correct" : awarded > 0 ? "partial" : "wrong";
        current.memo =
          current.result === "correct"
            ? "OK"
            : current.result === "partial"
              ? "部分点。根拠を確認"
              : current.result === "unanswered"
                ? "未入力"
                : "解説で確認";
      });
    });

  const sections = new Map<string, SectionAnalysis>();
  activeQuestions.forEach((question, index) => {
    const section = getQuestionSection(question, index);
    const current =
      sections.get(section.key) ??
      ({
        key: section.key,
        title: section.title,
        score: sectionScores.get(section.key)?.score ?? 0,
        maxScore: sectionScores.get(section.key)?.maxScore ?? 0,
        questions: [],
      } satisfies SectionAnalysis);
    const analysis = questionAnalyses.get(question.id);
    if (analysis) current.questions.push(analysis);
    sections.set(section.key, current);
  });

  return [...sections.values()].map((section) => ({
    ...section,
    maxScore: section.maxScore || section.questions.reduce((sum, question) => sum + question.points, 0),
  }));
}

function sectionRate(section: SectionAnalysis) {
  return section.maxScore > 0 ? Math.round((section.score / section.maxScore) * 100) : 0;
}

function getTone(rate: number, answered = true): SectionTone {
  if (!answered) return "slate";
  if (rate >= 80) return "teal";
  if (rate >= 60) return "blue";
  if (rate >= 40) return "orange";
  return "red";
}

function toneClasses(tone: SectionTone, selected = false) {
  const base = selected ? "ring-2 ring-offset-0" : "";
  const map = {
    teal: `border-emerald-300 bg-emerald-500/18 shadow-emerald-500/18 ${base} ring-emerald-200/85`,
    blue: `border-sky-300 bg-sky-500/20 shadow-sky-500/16 ${base} ring-sky-200/85`,
    orange: `border-amber-300 bg-amber-500/18 shadow-amber-500/18 ${base} ring-amber-200/85`,
    red: `border-rose-300 bg-rose-600/24 shadow-rose-500/20 ${base} ring-rose-200/85`,
    slate: `border-slate-400/45 bg-slate-900/32 shadow-slate-500/10 ${base} ring-slate-300/70`,
  };
  return map[tone];
}

function toneText(tone: SectionTone) {
  return {
    teal: "text-emerald-300",
    blue: "text-sky-300",
    orange: "text-amber-300",
    red: "text-rose-300",
    slate: "text-slate-300",
  }[tone];
}

function priorityLabel(rate: number) {
  if (rate >= 80) return "低";
  if (rate >= 60) return "中";
  return "高";
}

function statusLabel(rate: number) {
  if (rate >= 80) return "良好";
  if (rate >= 60) return "復習推奨";
  return "要復習";
}

function attemptLabel(index: number) {
  return `${index + 1}回目`;
}

function attemptCardGridClass(count: number) {
  if (count <= 2) return "md:grid-cols-2";
  if (count === 3) return "md:grid-cols-3";
  if (count === 4) return "md:grid-cols-2 xl:grid-cols-4";
  return "md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5";
}

function resultSymbol(result?: QuestionAnalysis["result"]) {
  if (result === "correct") return "○";
  if (result === "partial") return "△";
  if (result === "wrong") return "×";
  return "-";
}

function rateTone(rate: number | null) {
  if (rate === null) return "slate";
  if (rate >= 80) return "teal";
  if (rate >= 60) return "blue";
  if (rate >= 40) return "orange";
  return "red";
}

function heatCellClasses(rate: number | null, latest = false) {
  const tone = rateTone(rate);
  const map = {
    teal: "border-emerald-300 bg-emerald-400/30 text-emerald-50 shadow-[inset_0_0_0_1px_rgba(110,231,183,0.22),0_10px_26px_rgba(16,185,129,0.16)]",
    blue: "border-sky-300 bg-sky-500/34 text-sky-50 shadow-[inset_0_0_0_1px_rgba(125,211,252,0.18),0_10px_26px_rgba(14,165,233,0.14)]",
    orange: "border-amber-300 bg-amber-500/36 text-amber-50 shadow-[inset_0_0_0_1px_rgba(252,211,77,0.22),0_10px_26px_rgba(245,158,11,0.16)]",
    red: "border-rose-300 bg-rose-600/42 text-rose-50 shadow-[inset_0_0_0_1px_rgba(253,164,175,0.24),0_10px_26px_rgba(225,29,72,0.18)]",
    slate: "border-slate-300/40 bg-slate-500/18 text-slate-100",
  };
  return `${map[tone]} ${latest ? "ring-2 ring-white/80" : ""}`;
}

function lightHeatCellClasses(rate: number | null, latest = false) {
  const tone = rateTone(rate);
  const map = {
    teal: "border-emerald-400 bg-emerald-200/72 text-emerald-950 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.30),0_8px_20px_rgba(16,185,129,0.16)]",
    blue: "border-sky-400 bg-sky-200/72 text-sky-950 shadow-[inset_0_0_0_1px_rgba(14,165,233,0.30),0_8px_20px_rgba(14,165,233,0.16)]",
    orange: "border-amber-400 bg-amber-200/78 text-amber-950 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.32),0_8px_20px_rgba(245,158,11,0.17)]",
    red: "border-rose-400 bg-rose-200/76 text-rose-950 shadow-[inset_0_0_0_1px_rgba(244,63,94,0.32),0_8px_20px_rgba(244,63,94,0.17)]",
    slate: "border-slate-300 bg-slate-50 text-slate-800",
  };
  return `${map[tone]} ${latest ? "ring-2 ring-orange-400" : ""}`;
}

function heatLabelCellClasses() {
  return "border-amber-100 bg-[#fff8e8] text-slate-950 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.74),0_8px_20px_rgba(15,23,42,0.12)]";
}

function weakBadgeClasses(rate: number) {
  if (rate < 40) return "border-rose-200 border-l-4 border-l-rose-500 bg-white text-slate-950 shadow-[0_10px_26px_rgba(15,23,42,0.12)]";
  if (rate < 60) return "border-amber-200 border-l-4 border-l-amber-500 bg-white text-slate-950 shadow-[0_10px_26px_rgba(15,23,42,0.12)]";
  return "border-sky-200 border-l-4 border-l-sky-500 bg-white text-slate-950 shadow-[0_10px_26px_rgba(15,23,42,0.12)]";
}


function normalizeSectionTitle(title: string) {
  return title.match(/\u7b2c\d+\u554f/)?.[0] ?? title;
}

function getSectionTheme(year: string, subject: string, sectionTitle: string, examRoot = "common") {
  const normalizedTitle = normalizeSectionTitle(sectionTitle);
  const master = sectionThemeMaster as Record<string, SectionThemeEntry>;
  return master[`${examRoot}:${year}:${subject}:${normalizedTitle}`] ?? master[`${year}:${subject}:${normalizedTitle}`] ?? null;
}

function getSectionThemesForExam(year: string, subject: string, examRoot = "common") {
  const master = sectionThemeMaster as Record<string, SectionThemeEntry>;
  return Object.entries(master)
    .filter(([key]) => key.startsWith(`${examRoot}:${year}:${subject}:`) || key.startsWith(`${year}:${subject}:`))
    .map(([, value]) => value)
    .sort((a, b) => {
      const aNumber = Number(normalizeSectionTitle(a.sectionTitle).match(/\d+/)?.[0] ?? 0);
      const bNumber = Number(normalizeSectionTitle(b.sectionTitle).match(/\d+/)?.[0] ?? 0);
      return aNumber - bNumber;
    });
}

function applyThemeSectionsToSchema(schema: MarksheetSchema, year: string, subject: string, examRoot = "common"): MarksheetSchema {
  const alreadyGrouped = schema.questions.some((question) => question.sectionId || question.sectionTitle);
  if (alreadyGrouped) return schema;

  const themes = getSectionThemesForExam(year, subject, examRoot).filter((theme) => typeof theme.points === "number" && theme.points > 0);
  if (!themes.length) return schema;

  const effectiveRules = buildEffectiveScoringRules(schema);
  const totalThemePoints = themes.reduce((sum, theme) => sum + (theme.points ?? 0), 0);
  const totalRulePoints = effectiveRules.reduce((sum, rule) => sum + rule.points, 0);
  if (totalThemePoints !== totalRulePoints) return schema;

  const assignments = new Map<string, { id: string; title: string }>();
  let ruleIndex = 0;

  for (const [themeIndex, theme] of themes.entries()) {
    const section = { id: `theme_${themeIndex + 1}`, title: theme.sectionTitle };
    let points = 0;

    while (ruleIndex < effectiveRules.length && points < (theme.points ?? 0)) {
      const rule = effectiveRules[ruleIndex];
      points += rule.points;
      rule.questionIds.forEach((questionId) => assignments.set(questionId, section));
      ruleIndex += 1;
    }

    if (points !== theme.points) return schema;
  }

  if (assignments.size === 0) return schema;

  return {
    ...schema,
    questions: schema.questions.map((question) => {
      const section = assignments.get(question.id);
      return section ? { ...question, sectionId: section.id, sectionTitle: section.title, prompt: section.title } : question;
    }),
    scoringRules: schema.scoringRules?.map((rule) => {
      const section = assignments.get(rule.questionIds[0]);
      return section ? { ...rule, sectionId: section.id, sectionTitle: section.title } : rule;
    }),
  };
}

function formatSectionTheme(theme: SectionThemeEntry | null) {
  if (!theme?.themes?.length) return "\u5358\u5143\u30c6\u30fc\u30de\u672a\u767b\u9332";
  return theme.themes
    .map((item) => [item.branch, item.theme].filter(Boolean).join(" "))
    .join(" / ");
}

function ResultMark({ result }: { result: QuestionAnalysis["result"] }) {
  if (result === "correct") {
    return (
      <span className="mx-auto inline-flex h-8 w-8 items-center justify-center text-cyan-300">
        <CheckCircle2 className="h-6 w-6" />
      </span>
    );
  }
  if (result === "partial") {
    return (
      <span className="mx-auto inline-flex h-8 w-8 items-center justify-center text-xl font-black text-orange-300">
        \u25b3
      </span>
    );
  }
  if (result === "unanswered") return <span className="text-sm font-black text-slate-400">-</span>;
  return (
    <span className="mx-auto inline-flex h-8 w-8 items-center justify-center text-red-300">
      <XCircle className="h-6 w-6" />
    </span>
  );
}

function SummaryMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-w-[160px] items-center gap-4 border-r border-blue-300/25 px-5 last:border-r-0">
      <div className="text-blue-300">{icon}</div>
      <div>
        <p className="text-sm font-bold text-blue-100/72">{label}</p>
        <div className="mt-1 text-2xl font-black text-white">{value}</div>
      </div>
    </div>
  );
}

export default function ScoreAnalysisPage({ params }: { params: Promise<{ year: string; subject: string }> }) {
  const resolved = use(params);
  const examId = `common/${resolved.year}/${resolved.subject}`;
  const reinforcementId = reinforcementExamId(resolved.year, resolved.subject);
  const [user, setUser] = useState<User | null>(null);
  const [metadata, setMetadata] = useState<ExamMetadata | null>(null);
  const [marksheet, setMarksheet] = useState<MarksheetSchema | null>(null);
  const [reinforcementMarksheet, setReinforcementMarksheet] = useState<MarksheetSchema | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [attemptSubmissions, setAttemptSubmissions] = useState<Submission[]>([]);
  const [reinforcementSubmissions, setReinforcementSubmissions] = useState<Submission[]>([]);
  const [goals, setGoals] = useState<StudentGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSectionIndex, setSelectedSectionIndex] = useState(0);
  const detailRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const [me, metadataData, marksheetData, reinforcementMarksheetData, submissionData] = await Promise.all([
          fetch("/api/auth/me").then((res) => (res.ok ? res.json() : { user: null })),
          fetch(`/api/files/${examId}/metadata.json`).then((res) => (res.ok ? res.json() : null)),
          fetch(`/api/files/${examId}/marksheet.json`).then((res) => (res.ok ? res.json() : null)),
          fetch(`/api/files/${reinforcementId}/marksheet.json`).then((res) => (res.ok ? res.json() : null)),
          fetch("/api/submissions?mine=1&includeContent=1").then((res) => (res.ok ? res.json() : [])),
        ]);
        if (!active) return;
        const merged = Array.isArray(submissionData) ? submissionData : [];
        const attempts = merged
          .filter((item) => item.examId === examId && item.status === "graded")
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        const reinforcementAttempts = merged
          .filter((item) => item.examId === reinforcementId && item.status === "graded")
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        const latest =
          merged
            .filter((item) => item.examId === examId && item.status === "graded")
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0] ?? null;
        setUser(me.user);
        setMetadata(metadataData as ExamMetadata | null);
        setMarksheet(marksheetData as MarksheetSchema | null);
        setReinforcementMarksheet(reinforcementMarksheetData as MarksheetSchema | null);
        setSubmission(latest);
        setAttemptSubmissions(attempts);
        setReinforcementSubmissions(reinforcementAttempts);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [examId, reinforcementId]);

  useEffect(() => {
    if (!user?.id) {
      setGoals([]);
      return;
    }
    fetch(`/api/student-goals?studentId=${user.id}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setGoals(Array.isArray(data) ? data : []))
      .catch(() => setGoals([]));
  }, [user?.id]);

  const payload = useMemo(() => (submission ? parseMarksheetSubmission(submission.content) : null), [submission]);
  const effectiveMarksheet = useMemo(
    () => (marksheet ? applyThemeSectionsToSchema(marksheet, resolved.year, resolved.subject, "common") : null),
    [marksheet, resolved.subject, resolved.year],
  );
  const effectiveReinforcementMarksheet = useMemo(
    () =>
      reinforcementMarksheet
        ? applyThemeSectionsToSchema(reinforcementMarksheet, resolved.year, resolved.subject, "common_retake")
        : null,
    [reinforcementMarksheet, resolved.subject, resolved.year],
  );
  const sections = useMemo(() => (effectiveMarksheet ? buildAnalysis(effectiveMarksheet, payload) : []), [effectiveMarksheet, payload]);
  const attemptAnalyses = useMemo<AttemptAnalysis[]>(() => {
    if (!effectiveMarksheet) return [];
    return attemptSubmissions.map((item, index) => {
      const attemptPayload = parseMarksheetSubmission(item.content);
      const attemptSections = buildAnalysis(effectiveMarksheet, attemptPayload);
      const attemptScore = item.score ?? attemptSections.reduce((sum, section) => sum + section.score, 0);
      const attemptMaxScore = item.maxScore ?? attemptSections.reduce((sum, section) => sum + section.maxScore, 0);
      return {
        submission: item,
        index,
        payload: attemptPayload,
        sections: attemptSections,
        score: attemptScore,
        maxScore: attemptMaxScore,
        rate: attemptMaxScore > 0 ? Math.round((attemptScore / attemptMaxScore) * 100) : 0,
      };
    });
  }, [attemptSubmissions, effectiveMarksheet]);
  const displayedAttemptAnalyses = useMemo(
    () => attemptAnalyses.slice(-DISPLAYED_ATTEMPT_LIMIT),
    [attemptAnalyses],
  );
  const reinforcementAttemptAnalyses = useMemo<AttemptAnalysis[]>(() => {
    if (!effectiveReinforcementMarksheet) return [];
    return reinforcementSubmissions.map((item, index) => {
      const attemptPayload = parseMarksheetSubmission(item.content);
      const attemptSections = buildAnalysis(effectiveReinforcementMarksheet, attemptPayload);
      const attemptScore = item.score ?? attemptSections.reduce((sum, section) => sum + section.score, 0);
      const attemptMaxScore = item.maxScore ?? attemptSections.reduce((sum, section) => sum + section.maxScore, 0);
      return {
        submission: item,
        index,
        payload: attemptPayload,
        sections: attemptSections,
        score: attemptScore,
        maxScore: attemptMaxScore,
        rate: attemptMaxScore > 0 ? Math.round((attemptScore / attemptMaxScore) * 100) : 0,
      };
    });
  }, [effectiveReinforcementMarksheet, reinforcementSubmissions]);
  const displayedReinforcementAttemptAnalyses = useMemo(
    () => reinforcementAttemptAnalyses.slice(-DISPLAYED_ATTEMPT_LIMIT),
    [reinforcementAttemptAnalyses],
  );
  const reinforcementSectionComparisonRows = useMemo(() => {
    const keys = new Map<string, { key: string; title: string; maxScore: number }>();
    displayedReinforcementAttemptAnalyses.forEach((attempt) => {
      attempt.sections.forEach((section) => {
        if (!keys.has(section.key)) keys.set(section.key, { key: section.key, title: section.title, maxScore: section.maxScore });
      });
    });
    return [...keys.values()];
  }, [displayedReinforcementAttemptAnalyses]);
  const sectionThemes = useMemo(
    () => sections.map((section) => getSectionTheme(resolved.year, resolved.subject, section.title)),
    [resolved.subject, resolved.year, sections],
  );
  const selectedSection = sections[selectedSectionIndex] ?? sections[0];
  const selectedSectionTheme = sectionThemes[selectedSectionIndex] ?? null;
  const selectedSectionAttempts = useMemo(() => {
    if (!selectedSection) return [];
    return displayedAttemptAnalyses.map((attempt) => ({
      ...attempt,
      section: attempt.sections.find((section) => section.key === selectedSection.key),
    }));
  }, [displayedAttemptAnalyses, selectedSection]);
  const sectionComparisonRows = useMemo(() => {
    const keys = new Map<string, { key: string; title: string; maxScore: number }>();
    displayedAttemptAnalyses.forEach((attempt) => {
      attempt.sections.forEach((section) => {
        if (!keys.has(section.key)) keys.set(section.key, { key: section.key, title: section.title, maxScore: section.maxScore });
      });
    });
    return [...keys.values()];
  }, [displayedAttemptAnalyses]);
  const weakComparisonRows = useMemo(() => {
    return sectionComparisonRows
      .map((row) => {
        const latestAttempt = displayedAttemptAnalyses[displayedAttemptAnalyses.length - 1];
        const latestSection = latestAttempt?.sections.find((section) => section.key === row.key);
        const latestRate = latestSection && latestSection.maxScore > 0 ? sectionRate(latestSection) : 0;
        const lowestRate = Math.min(
          ...displayedAttemptAnalyses.map((attempt) => {
            const section = attempt.sections.find((item) => item.key === row.key);
            return section && section.maxScore > 0 ? sectionRate(section) : 0;
          }),
        );
        const weakCount = displayedAttemptAnalyses.filter((attempt) => {
          const section = attempt.sections.find((item) => item.key === row.key);
          return section && section.maxScore > 0 && sectionRate(section) < 60;
        }).length;
        return {
          ...row,
          latestRate,
          lowestRate,
          weakCount,
          theme: formatSectionTheme(getSectionTheme(resolved.year, resolved.subject, row.title)),
        };
      })
      .filter((row) => row.latestRate < 80 || row.weakCount > 0)
      .sort((left, right) => right.weakCount - left.weakCount || left.latestRate - right.latestRate)
      .slice(0, 3);
  }, [displayedAttemptAnalyses, resolved.subject, resolved.year, sectionComparisonRows]);
  const score = submission?.score ?? sections.reduce((sum, section) => sum + section.score, 0);
  const maxScore = submission?.maxScore ?? sections.reduce((sum, section) => sum + section.maxScore, 0);
  const rate = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const subjectLabel = subjectLabels[resolved.subject] ?? metadata?.subject ?? resolved.subject;
  const firstGoal = goals[0];
  const goalGap = firstGoal ? Math.max(firstGoal.bRate - rate, 0) : null;
  const sortedWeakSections = [...sections]
    .filter((section) => section.maxScore > 0)
    .sort((left, right) => sectionRate(left) - sectionRate(right));
  const prioritySections = sortedWeakSections.filter((section) => sectionRate(section) < 70);
  const firstPriority = prioritySections[0] ?? sortedWeakSections[0] ?? null;
  const nextStep = firstPriority ? `第${sections.indexOf(firstPriority) + 1}問 → 解き直し → 解説確認` : "解説確認 → 類題演習";

  useEffect(() => {
    if (!sections.length) return;
    setSelectedSectionIndex((current) => Math.min(current, sections.length - 1));
  }, [sections.length]);

  function openSectionDetail(index: number) {
    setSelectedSectionIndex(index);
    window.requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#061126] text-white">
        <Loader2 className="h-10 w-10 animate-spin text-cyan-300" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#061126] text-white">
      <AppHeader variant="dark" />
      <main className="mx-auto max-w-[1580px] px-4 py-6 md:px-7">
        <div className="mb-5 flex flex-wrap items-center gap-3 text-sm font-bold text-blue-100/85">
          <Link href="/results" className="inline-flex items-center gap-2 hover:text-white">
            <Home className="h-4 w-4" />
            ダッシュボード
          </Link>
          <span>/</span>
          <Link href="/practice/common" className="hover:text-white">年度別演習</Link>
          <span>/</span>
          <span>{resolved.year}年度</span>
          <span>/</span>
          <span>{subjectLabel}</span>
        </div>

        <section className="relative overflow-hidden rounded-[24px] border border-blue-400/55 bg-[linear-gradient(135deg,rgba(6,28,64,0.92),rgba(2,12,30,0.9))] p-6 shadow-[0_0_48px_rgba(37,99,235,0.24)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.24),transparent_32%)]" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[18px] border border-blue-300/40 bg-blue-600/22 text-blue-200 shadow-[0_0_30px_rgba(37,99,235,0.35)]">
              <BarChart3 className="h-11 w-11" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl font-black tracking-[0.04em] text-white md:text-4xl">
                {resolved.year}年度 {subjectLabel} 本試験演習結果
              </h1>
              <p className="mt-2 text-lg font-black text-blue-300">{metadata?.title ?? "本試験"} <span className="text-white/70">/ 共通テスト</span></p>
              <p className="mt-3 text-sm font-bold text-blue-100/72">大問別の得点率から、最短で伸びる復習順を提示します。</p>
            </div>
          </div>

          {submission ? (
            <div className="relative mt-6 flex flex-wrap gap-y-5">
              <SummaryMetric icon={<Target className="h-8 w-8" />} label="得点" value={<>{score}<span className="text-base text-blue-100/64"> / {maxScore}</span></>} />
              <SummaryMetric icon={<Grid2X2 className="h-8 w-8" />} label="得点率" value={<>{rate}%</>} />
              <SummaryMetric icon={<CalendarDays className="h-8 w-8" />} label="実施日" value={new Date(submission.timestamp).toLocaleDateString("ja-JP")} />
              <SummaryMetric icon={<Clock3 className="h-8 w-8" />} label="所要時間" value={metadata?.time_minutes ? `${metadata.time_minutes}分` : "-"} />
              <SummaryMetric icon={<Star className="h-8 w-8" />} label="判定" value={goalGap === null ? "目標未設定" : goalGap === 0 ? "標準到達" : `あと${goalGap.toFixed(1)}点`} />
            </div>
          ) : (
            <div className="relative mt-6 rounded-[18px] border border-blue-300/30 bg-blue-500/10 px-5 py-4">
              <p className="font-black text-blue-100">この年度・科目の自動採点結果はまだありません。</p>
              <p className="mt-2 text-sm font-bold text-blue-100/72">演習画面でマークシートを入力すると、大問別の○×と復習優先度が反映されます。</p>
              <Link href={examHref(resolved.year, resolved.subject)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-black text-white hover:bg-blue-500">
                演習を開始
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}

        </section>

        {submission && sections.length > 0 && selectedSection && (
          <>
            {attemptAnalyses.length > 1 && (
              <section className="mt-7 overflow-hidden rounded-[22px] border border-cyan-300/40 bg-[linear-gradient(135deg,rgba(7,25,58,0.96),rgba(3,12,30,0.92))] text-white shadow-[0_24px_70px_rgba(0,0,0,0.28)] backdrop-blur">
                <div className="flex flex-col gap-3 border-b border-cyan-300/15 bg-cyan-400/8 px-6 py-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="flex items-center gap-2 text-3xl font-black">
                      <TrendingUp className="h-6 w-6 text-cyan-300" />
                      本試験演習比較
                    </h2>
                    <p className="mt-2 text-base font-bold text-blue-100/78">最大で直近5回分を表示。大問ごとの得点率で、弱点単元を分析しましょう。</p>
                  </div>
                  <Link href={examHref(resolved.year, resolved.subject)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-4 text-base font-black text-white shadow-[0_14px_34px_rgba(37,99,235,0.28)] hover:bg-blue-500">
                    次の再挑戦へ
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>

                <div className="space-y-5 p-6">
                  <div>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-xl font-black text-blue-100">総得点の推移</h3>
                      {attemptAnalyses.length > DISPLAYED_ATTEMPT_LIMIT && (
                        <span className="rounded-full border border-cyan-300/45 bg-cyan-300/12 px-3 py-1 text-sm font-black text-cyan-100">
                          直近{DISPLAYED_ATTEMPT_LIMIT}回を表示 / 全{attemptAnalyses.length}回
                        </span>
                      )}
                    </div>
                    <div className={`grid gap-3 ${attemptCardGridClass(displayedAttemptAnalyses.length)}`}>
                      {displayedAttemptAnalyses.map((attempt) => {
                        const latest = attempt.index === attemptAnalyses.length - 1;
                        return (
                          <div key={attempt.submission.id} className={`rounded-2xl border p-4 ${heatCellClasses(attempt.rate, latest)}`}>
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-base font-black">{attemptLabel(attempt.index)}</p>
                              {latest && <span className="rounded-full bg-cyan-300 px-2 py-0.5 text-xs font-black text-cyan-950">最新</span>}
                            </div>
                            <p className="mt-2 text-4xl font-black leading-none">
                              {attempt.score}
                              <span className="text-xl opacity-70"> / {attempt.maxScore}</span>
                            </p>
                            <p className="mt-2 text-base font-bold opacity-82">{new Date(attempt.submission.timestamp).toLocaleDateString("ja-JP")}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-xl font-black text-blue-100">大問別ヒートマップ</h3>
                        <div className="flex flex-wrap gap-3 text-xs font-black text-blue-100/80">
                          <RateDot color="bg-emerald-400" label="80%以上" />
                          <RateDot color="bg-sky-500" label="60〜79%" />
                          <RateDot color="bg-amber-400" label="40〜59%" />
                          <RateDot color="bg-rose-500" label="40%未満" />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <div className="grid grid-cols-[160px_repeat(var(--attempt-count),minmax(120px,1fr))] gap-2 text-sm font-black text-blue-100/72" style={{ "--attempt-count": displayedAttemptAnalyses.length } as React.CSSProperties}>
                          <div>大問</div>
                          {displayedAttemptAnalyses.map((attempt) => <div key={attempt.submission.id}>{attemptLabel(attempt.index)}</div>)}
                        </div>
                        {sectionComparisonRows.map((row) => {
                          return (
                            <div key={row.key} className="grid grid-cols-[160px_repeat(var(--attempt-count),minmax(120px,1fr))] gap-2" style={{ "--attempt-count": displayedAttemptAnalyses.length } as React.CSSProperties}>
                              <button type="button" onClick={() => openSectionDetail(sectionComparisonRows.findIndex((item) => item.key === row.key))} className={`rounded-xl border px-4 py-3 text-left font-black transition hover:-translate-y-0.5 ${heatLabelCellClasses()}`}>
                                <span className="block text-base">{row.title}</span>
                                <span className="mt-1 line-clamp-1 block text-xs text-slate-600">{formatSectionTheme(getSectionTheme(resolved.year, resolved.subject, row.title))}</span>
                              </button>
                              {displayedAttemptAnalyses.map((attempt) => {
                                const section = attempt.sections.find((item) => item.key === row.key);
                                const sectionRateValue = section && section.maxScore > 0 ? sectionRate(section) : null;
                                const latest = attempt.index === attemptAnalyses.length - 1;
                                return (
                                  <div key={attempt.submission.id} className={`rounded-xl border px-4 py-3 ${heatCellClasses(sectionRateValue, latest)}`}>
                                    <p className="text-2xl font-black">{section ? `${section.score} / ${section.maxScore}` : "-"}</p>
                                    <p className="mt-1 text-sm font-black opacity-80">{sectionRateValue === null ? "-" : `${sectionRateValue}%`}</p>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <aside className="rounded-2xl border border-amber-100/80 bg-[#fff8e8] p-5 text-slate-900 shadow-[0_18px_42px_rgba(15,23,42,0.22)]">
                    <p className="flex items-center gap-2 text-sm font-black tracking-[0.16em] text-amber-700">
                      <AlertTriangle className="h-5 w-5" />
                      WEAK POINTS
                    </p>
                    <h3 className="mt-2 text-2xl font-black text-slate-950">優先して見る弱点単元</h3>
                    <div className="mt-4 space-y-3">
                      {weakComparisonRows.length === 0 ? (
                        <div className="rounded-xl border border-emerald-200 bg-white p-4 text-base font-black text-emerald-800">最新回は大きな弱点なし。維持演習へ。</div>
                      ) : (
                        weakComparisonRows.map((row) => (
                          <button
                            key={row.key}
                            type="button"
                            onClick={() => openSectionDetail(sectionComparisonRows.findIndex((item) => item.key === row.key))}
                            className={`w-full rounded-xl border p-4 text-left transition hover:-translate-y-0.5 ${weakBadgeClasses(row.latestRate)}`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-xl font-black">{row.title}</p>
                              <span className="rounded-full bg-slate-900/8 px-2 py-1 text-sm font-black text-slate-800">最新 {row.latestRate}%</span>
                            </div>
                            <p className="mt-2 line-clamp-2 text-sm font-bold opacity-85">{row.theme}</p>
                            <p className="mt-3 text-sm font-black opacity-90">60%未満: {row.weakCount}回 / 最低 {row.lowestRate}%</p>
                          </button>
                        ))
                      )}
                    </div>
                  </aside>
                  </div>
                </div>
              </section>
            )}

            {reinforcementAttemptAnalyses.length > 0 && (
              <section className="mt-7 overflow-hidden rounded-[22px] border border-orange-300/55 bg-[#fff8e8] text-slate-950 shadow-[0_24px_70px_rgba(0,0,0,0.24)]">
                <div className="flex flex-col gap-3 border-b border-orange-200 bg-white/72 px-6 py-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="flex items-center gap-2 text-3xl font-black text-slate-950">
                      <Target className="h-7 w-7 text-orange-500" />
                      弱点補強演習
                    </h2>
                    <p className="mt-2 text-base font-black text-slate-600">
                      弱点補強演習の得点推移と大問別の得点率を確認できます。（直近３回目分まで表示）
                    </p>
                  </div>
                  <Link href={reinforcementExamHref(resolved.year, resolved.subject)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-4 text-base font-black text-white shadow-[0_14px_34px_rgba(249,115,22,0.26)] hover:bg-orange-400">
                    弱点補強演習へ
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>

                <div className="space-y-5 p-6">
                  <div className="rounded-2xl border border-orange-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-2xl font-black text-slate-950">補強演習の履歴</h3>
                      {reinforcementAttemptAnalyses.length > DISPLAYED_ATTEMPT_LIMIT && (
                        <span className="rounded-full border border-orange-300 bg-orange-50 px-3 py-1 text-sm font-black text-orange-700">
                          直近{DISPLAYED_ATTEMPT_LIMIT}回分を表示 / 全{reinforcementAttemptAnalyses.length}回
                        </span>
                      )}
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2 text-lg font-black text-slate-800">
                      {displayedReinforcementAttemptAnalyses.map((attempt, index) => (
                        <span key={attempt.submission.id} className="inline-flex items-center gap-2">
                          {index > 0 && <span className="text-orange-400">→</span>}
                          <span className="rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-slate-950">
                            {attemptLabel(attempt.index)} {attempt.score}点
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-orange-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-2xl font-black text-slate-950">大問別比較</h3>
                      <div className="flex flex-wrap gap-3 text-sm font-black text-slate-600">
                        <RateDot color="bg-emerald-400" label="80%以上" />
                        <RateDot color="bg-sky-500" label="60〜79%" />
                        <RateDot color="bg-amber-400" label="40〜59%" />
                        <RateDot color="bg-rose-500" label="40%未満" />
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <div className="grid min-w-[820px] gap-2">
                        <div className="grid grid-cols-[180px_repeat(var(--reinforcement-count),minmax(125px,1fr))] gap-2 text-sm font-black text-slate-600" style={{ "--reinforcement-count": displayedReinforcementAttemptAnalyses.length } as React.CSSProperties}>
                          <div>大問</div>
                          {displayedReinforcementAttemptAnalyses.map((attempt) => <div key={attempt.submission.id}>{attemptLabel(attempt.index)}</div>)}
                        </div>
                        {reinforcementSectionComparisonRows.map((row) => (
                          <div key={row.key} className="grid grid-cols-[180px_repeat(var(--reinforcement-count),minmax(125px,1fr))] gap-2" style={{ "--reinforcement-count": displayedReinforcementAttemptAnalyses.length } as React.CSSProperties}>
                            <div className={`rounded-xl border px-4 py-3 font-black ${heatLabelCellClasses()}`}>
                              <span className="block text-lg">{row.title}</span>
                              <span className="mt-1 line-clamp-2 block text-sm leading-snug text-slate-600">{formatSectionTheme(getSectionTheme(resolved.year, resolved.subject, row.title, "common_retake"))}</span>
                            </div>
                            {displayedReinforcementAttemptAnalyses.map((attempt) => {
                              const section = attempt.sections.find((item) => item.key === row.key);
                              const sectionRateValue = section && section.maxScore > 0 ? sectionRate(section) : null;
                              const latest = attempt.index === reinforcementAttemptAnalyses.length - 1;
                              return (
                                <div key={attempt.submission.id} className={`rounded-xl border px-4 py-3 ${lightHeatCellClasses(sectionRateValue, latest)}`}>
                                  <p className="text-2xl font-black">{section ? `${section.score} / ${section.maxScore}` : "-"}</p>
                                  <p className="mt-1 text-sm font-black opacity-80">{sectionRateValue === null ? "-" : `${sectionRateValue}%`}</p>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="flex items-center gap-2 text-2xl font-black">
                  <Grid2X2 className="h-6 w-6 text-cyan-300" />
                  本試験演習　大問別サマリー
                </h2>
                {attemptAnalyses.length > 1 && (
                  <span className="rounded-full border border-cyan-300/70 bg-cyan-300/18 px-3 py-1 text-sm font-black text-cyan-50 shadow-[0_8px_22px_rgba(34,211,238,0.16)]">
                    最新：{attemptLabel(attemptAnalyses.length - 1)}演習
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-5 rounded-full border border-white/10 bg-white/7 px-4 py-2 backdrop-blur">
                <RateDot color="bg-emerald-400" label="80%以上" />
                <RateDot color="bg-sky-500" label="60〜79%" />
                <RateDot color="bg-amber-400" label="40〜59%" />
                <RateDot color="bg-rose-500" label="40%未満" />
                <RateDot color="bg-slate-400" label="未受験・未入力" />
              </div>
            </div>

            <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {sections.map((section, index) => {
                const currentRate = sectionRate(section);
                const tone = getTone(currentRate, section.questions.some((question) => question.selectedAnswer !== "-"));
                const selected = selectedSectionIndex === index;
                const theme = sectionThemes[index] ?? null;
                return (
                  <button
                    key={section.key}
                    type="button"
                    onClick={() => openSectionDetail(index)}
                    className={`rounded-2xl border p-4 text-left shadow-[0_14px_34px_rgba(0,0,0,0.16)] backdrop-blur transition hover:-translate-y-0.5 ${toneClasses(tone, selected)}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-lg border border-current bg-white/8 px-2.5 py-0.5 text-sm font-black text-white">第{index + 1}問</span>
                      <span className={`rounded-lg border px-2.5 py-0.5 text-sm font-black ${toneText(tone)} border-current`}>
                        {statusLabel(currentRate)}
                      </span>
                    </div>
                    <p className="mt-3 text-xl font-black text-white">{section.title}</p>
                    <p className="mt-1 line-clamp-1 text-base font-black leading-relaxed text-cyan-50/90">
                      {formatSectionTheme(theme)}
                    </p>
                    <p className={`mt-3 text-4xl font-black ${toneText(tone)}`}>
                      {section.score}<span className="text-xl text-blue-100/64"> / {section.maxScore}</span>
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-bold text-blue-100/72">
                      <span>得点率 <span className={toneText(tone)}>{currentRate}%</span></span>
                      <span>優先度 <span className={`rounded-full px-2 py-0.5 ${tone === "red" ? "bg-red-500 text-white" : tone === "orange" ? "bg-orange-500 text-white" : "bg-cyan-500/20 text-cyan-200"}`}>{priorityLabel(currentRate)}</span></span>
                    </div>
                    <span className={`mt-3 flex items-center justify-center gap-2 rounded-lg border px-4 py-2 font-black ${tone === "red" || tone === "orange" ? "border-orange-400 text-orange-200" : "border-cyan-400 text-cyan-200"}`}>
                      詳細を見る
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </button>
                );
              })}
            </section>

            <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.7fr)]">
              <section className="rounded-[18px] border border-blue-400/45 bg-blue-950/42 p-5 shadow-[0_18px_46px_rgba(0,0,0,0.18)] backdrop-blur">
                <h2 className="flex items-center gap-2 text-xl font-black">
                  <Target className="h-6 w-6 text-blue-300" />
                  学習アクション
                </h2>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <ActionBox icon={<RotateCcw className="h-7 w-7" />} label="優先復習" text={firstPriority ? `第${sections.indexOf(firstPriority) + 1}問` : "解説確認"} tone="blue" />
                  <ActionBox icon={<AlertTriangle className="h-7 w-7" />} label="弱点単元" text={firstPriority?.title ?? selectedSection.title} tone="orange" />
                  <ActionBox icon={<Lightbulb className="h-7 w-7" />} label="次の一手" text={nextStep} tone="teal" />
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                  <Link href={`/practice/common?mode=reinforcement&year=${resolved.year}&subject=${resolved.subject}`} className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-4 text-lg font-black text-white shadow-[0_14px_34px_rgba(37,99,235,0.28)] hover:bg-blue-500">
                    弱点補強演習へ進む
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                  <Link href="/videos" className="flex items-center justify-center gap-2 rounded-xl border border-cyan-300/40 bg-cyan-400/10 px-5 py-4 font-black text-cyan-100 hover:bg-cyan-400/16">
                    講座で補強
                  </Link>
                </div>
              </section>

              <section className="rounded-[18px] border border-blue-400/45 bg-blue-950/42 p-5 shadow-[0_18px_46px_rgba(0,0,0,0.18)] backdrop-blur">
                <h2 className="flex items-center gap-2 text-xl font-black">
                  <Info className="h-6 w-6 text-blue-300" />
                  この画面の見方
                </h2>
                <div className="mt-4 space-y-3">
                  <GuideRow icon={<ListChecks className="h-6 w-6" />} text="各大問カードの「詳細を見る」から小問ごとの○×を確認できます" />
                  <GuideRow icon={<BookOpen className="h-6 w-6" />} text="解説確認と解き直しで、弱点単元を補強できます" />
                  <GuideRow icon={<BarChart3 className="h-6 w-6" />} text="復習優先度を見ながら、次の学習を決められます" />
                </div>
              </section>
            </div>

            <section ref={detailRef} className="mt-6 scroll-mt-28 rounded-[18px] border border-blue-400/45 bg-blue-950/42 text-white shadow-[0_18px_46px_rgba(0,0,0,0.18)] backdrop-blur">
              <div className="flex flex-col gap-3 border-b border-blue-300/20 bg-blue-500/8 px-5 py-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-4">
                  <h2 className="text-2xl font-black text-blue-200">第{selectedSectionIndex + 1}問</h2>
                  <p className="text-lg font-black">{selectedSection.title}</p>
                  <p className="font-black">
                    得点：<span className="text-2xl text-blue-300">{selectedSection.score}</span> / {selectedSection.maxScore}
                  </p>
                  <p className="basis-full rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-50 md:basis-auto">
                    {formatSectionTheme(selectedSectionTheme)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link href={examHref(resolved.year, resolved.subject)} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-500">
                    <PencilLine className="h-4 w-4" />
                    解き直し
                  </Link>
                  <Link href={examHref(resolved.year, resolved.subject, true)} className="inline-flex items-center gap-2 rounded-lg border border-blue-300/40 bg-white/8 px-4 py-3 text-sm font-black text-blue-100 hover:bg-white/12">
                    <BookOpen className="h-4 w-4" />
                    解説を見る
                  </Link>
                </div>
              </div>

              <div className="overflow-x-auto p-4">
                <table className="w-full min-w-[760px] border-collapse text-center text-sm">
                  <thead className="bg-white/7 text-blue-100">
                    <tr>
                      <th className="border border-blue-300/15 px-3 py-3">設問</th>
                      <th className="border border-blue-300/15 px-3 py-3">内容</th>
                      <th className="border border-blue-300/15 px-3 py-3">配点</th>
                      <th className="border border-blue-300/15 px-3 py-3">結果</th>
                      <th className="border border-blue-300/15 px-3 py-3">あなたの解答</th>
                      <th className="border border-blue-300/15 px-3 py-3">正解</th>
                      <th className="border border-blue-300/15 px-3 py-3">復習</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSection.questions.map((row) => (
                      <tr key={row.id} className="hover:bg-blue-400/8">
                        <td className="border border-blue-300/15 px-3 py-3 font-bold">{row.displayLabel}</td>
                        <td className="border border-blue-300/15 px-3 py-3 text-left font-bold">{row.content}</td>
                        <td className="border border-blue-300/15 px-3 py-3">{row.points}</td>
                        <td className="border border-blue-300/15 px-3 py-3"><ResultMark result={row.result} /></td>
                        <td className="border border-blue-300/15 px-3 py-3 font-black">{row.selectedAnswer}</td>
                        <td className="border border-blue-300/15 px-3 py-3 font-black">{row.correctAnswer}</td>
                        <td className="border border-blue-300/15 px-3 py-3">
                          <Link href={row.result === "correct" ? examHref(resolved.year, resolved.subject, true) : examHref(resolved.year, resolved.subject)} className="inline-flex items-center gap-1 font-black text-blue-300 hover:text-blue-100">
                            {row.result === "correct" ? <BookOpen className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                            {row.result === "correct" ? "解説" : "解き直し"}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {attemptAnalyses.length > 1 && (
              <section className="mt-6 rounded-[18px] border border-blue-400/45 bg-blue-950/42 text-white shadow-[0_18px_46px_rgba(0,0,0,0.18)] backdrop-blur">
                <div className="border-b border-blue-300/20 bg-blue-500/8 px-5 py-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-black text-blue-100">第{selectedSectionIndex + 1}問 小問別比較</h2>
                    <span className="rounded-full border border-cyan-300/45 bg-cyan-300/12 px-3 py-1 text-sm font-black text-cyan-100">
                      直近5回分を表示
                    </span>
                  </div>
                  <p className="mt-2 text-base font-bold text-blue-100/72">同じ設問が回を追って○に変わっているか、横並びで確認できます。</p>
                </div>
                <div className="overflow-x-auto p-4">
                  <table className="w-full min-w-[920px] border-collapse text-center text-base">
                    <thead className="bg-white/7 text-lg text-blue-100">
                      <tr>
                        <th className="border border-blue-300/15 px-4 py-4">設問</th>
                        <th className="border border-blue-300/15 px-4 py-4 text-left">内容</th>
                        {selectedSectionAttempts.map((attempt) => (
                          <th key={attempt.submission.id} className="border border-blue-300/15 px-4 py-4">{attemptLabel(attempt.index)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSection.questions.map((question) => (
                        <tr key={question.id} className="hover:bg-blue-400/8">
                          <td className="border border-blue-300/15 px-4 py-4 text-lg font-black">{question.displayLabel}</td>
                          <td className="border border-blue-300/15 px-4 py-4 text-left text-base font-black leading-relaxed">{question.content}</td>
                          {selectedSectionAttempts.map((attempt) => {
                            const attemptQuestion = attempt.section?.questions.find((item) => item.id === question.id);
                            const symbol = resultSymbol(attemptQuestion?.result);
                            const color =
                              symbol === "○"
                                ? "text-cyan-300"
                                : symbol === "△"
                                  ? "text-orange-300"
                                  : symbol === "×"
                                    ? "text-red-300"
                                    : "text-slate-400";
                            return (
                              <td key={attempt.submission.id} className={`border border-blue-300/15 px-4 py-4 text-3xl font-black ${color}`}>
                                {symbol}
                                <span className="mt-1 block text-base font-black text-blue-100/65">{attemptQuestion?.selectedAnswer ?? "-"}</span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function RateDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm font-bold">
      <span className={`h-3 w-3 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function ActionBox({ icon, label, text, tone }: { icon: React.ReactNode; label: string; text: string; tone: "blue" | "orange" | "teal" }) {
  const color = {
    blue: "bg-blue-600 text-white",
    orange: "bg-orange-500 text-white",
    teal: "bg-cyan-500 text-white",
  }[tone];

  return (
    <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/6 p-4">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${color}`}>{icon}</div>
      <div className="min-w-0">
        <p className="font-black text-blue-200">{label}</p>
        <p className="mt-1 truncate font-bold text-white">{text}</p>
      </div>
    </div>
  );
}

function GuideRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/6 px-4 py-3">
      <div className="text-blue-300">{icon}</div>
      <p className="font-bold text-blue-50/90">{text}</p>
    </div>
  );
}
