"use client";

import { useEffect, useMemo, useRef, useState, use, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ExternalLink,
  Headphones,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Timer,
} from "lucide-react";
import type { ExamMetadata, MarksheetSchema, MarksheetScoringRule } from "@/types/exam";
import type { StudentGoal } from "@/types/admissions";
import { useBgm } from "@/components/BgmProvider";
import {
  buildEffectiveScoringRules,
  getActiveQuestions,
  getAnsweredCount,
  getAwardedPoints,
  getSelectionBounds,
  hasAnswerValue,
  matchesScoringRule,
  resolveSelectedSectionIds,
} from "@/lib/marksheet-scoring";

type User = {
  id: string;
  name: string;
  role: "student" | "teacher";
};

type PdfLayoutMode = "single" | "spread";
type TimeLimitFactor = "1" | "0.9" | "0.8";
type ExamPdfFile = { label: string; path: string; kind: "problem" | "answer" };
type ListeningAudioFile = { label: string; url: string; kind?: "audio" | "link" };
type ExamMetadataWithSource = ExamMetadata & {
  source?: {
    kind?: string;
    problem_url?: string | null;
    answer_url?: string | null;
  };
};

type GradeResult = {
  score: number;
  maxScore: number;
  correctCount: number;
  totalQuestions: number;
};

type QuestionResultMap = Record<string, boolean>;

type GoalGap = {
  id: string;
  label: string;
  bRate: number;
  currentScore100: number;
  gap: number;
  reached: boolean;
};

const PdfViewer = dynamic(() => import("@/components/PdfViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-accent animate-pulse">
      Initializing Viewer...
    </div>
  ),
});

const PDF_ZOOM_MIN = 70;
const PDF_ZOOM_MAX = 160;
const PDF_ZOOM_STEP = 10;
const SECONDARY_EXAM_TYPES = new Set(["todai", "kyodai", "nagoya", "hamamatsu_medical", "secondary"]);

const SECONDARY_EXAM_TYPE_LABELS: Record<string, string> = {
  todai: "東京大学",
  kyodai: "京都大学",
  nagoya: "名古屋大学",
  hamamatsu_medical: "浜松医科大学",
  secondary: "2次試験",
};

const SECONDARY_COURSE_LABELS: Record<string, string> = {
  common: "共通",
  humanities: "文科",
  science: "理科",
  medicine: "医学部",
  medical: "医学部",
};

const SUBJECT_LABELS: Record<string, string> = {
  english: "英語",
  math: "数学",
  japanese: "国語",
  physics: "物理",
  chemistry: "化学",
  biology: "生物",
  earth_science: "地学",
  science: "理科",
  social: "社会",
  english_listening: "英語リスニング",
  math_ia: "数学I・A",
  math_iib: "数学II・B",
  math_iibc: "数学II・B・C",
  japanese_history: "歴史総合・日本史探究",
  japanese_history_b: "日本史B",
  world_history: "歴史総合・世界史探究",
  world_history_b: "世界史B",
  geography: "地理総合・地理探究",
  geography_b: "地理B",
  public_ethics: "公共、倫理",
  public_politics_economy: "公共、政治・経済",
  integrated_history_public: "地理総合・歴史総合・公共",
  science_basics: "理科基礎",
  information_i: "情報I",
  information_related_basics: "情報関係基礎",
  politics_economy: "政治・経済",
  ethics: "倫理",
  ethics_politics_economy: "倫理、政治・経済",
  essay: "小論文",
};

function shouldShowProblemPdf(metadata: ExamMetadata | null) {
  const source = (metadata as ExamMetadataWithSource | null)?.source;
  if (metadata?.exam_type === "common_retake" && !source?.problem_url) return false;
  return true;
}

function isDirectAudioUrl(file: ListeningAudioFile) {
  if (file.kind === "link") return false;
  if (file.kind === "audio") return true;
  return /\.(mp3|m4a|aac|wav|ogg)(\?.*)?$/i.test(file.url);
}

function buildExamDisplayTitle(metadata: ExamMetadata | null, examId: string, selectedSubject: string | null) {
  const [typeFromId, yearFromId, subjectFromId, courseFromId] = examId.split("/");
  const examType = metadata?.exam_type ?? typeFromId;
  if (!SECONDARY_EXAM_TYPES.has(examType)) return metadata?.title ?? "Loading...";

  const year = metadata?.year ?? Number(yearFromId);
  const subject = selectedSubject || metadata?.subject || subjectFromId;
  const course = metadata?.course || courseFromId;
  const universityLabel = SECONDARY_EXAM_TYPE_LABELS[examType] ?? examType;
  const courseLabel = SECONDARY_COURSE_LABELS[course] ?? "";
  const subjectLabel = SUBJECT_LABELS[subject] ?? subject;
  const shouldShowSubject = Boolean(subjectLabel && subjectLabel !== courseLabel);

  return [universityLabel, courseLabel, Number.isFinite(year) ? `${year}` : "", shouldShowSubject ? subjectLabel : ""]
    .filter(Boolean)
    .join(" ");
}

function isRuleCorrectForDisplay(rule: MarksheetScoringRule, actual: string[]) {
  if (matchesScoringRule(rule, actual)) return true;
  return false;
}

function buildAutoFeedback(result: GradeResult) {
  if (result.score === result.maxScore) {
    return "全問正解です。すばらしいです。";
  }
  const ratio = result.maxScore === 0 ? 0 : result.score / result.maxScore;
  if (ratio >= 0.8) {
    return "高得点です。間違えた問題だけ見直すとさらに安定します。";
  }
  if (ratio >= 0.5) {
    return "半分以上できています。迷った問題を中心に復習しましょう。";
  }
  return "基礎の確認からやり直すと伸びやすい状態です。";
}

export default function ExamPage(props: { params: Promise<{ id: string[] }> }) {
  const params = use(props.params);
  const examId = params.id.join("/");
  const { stop: stopBgm } = useBgm();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedSubject = searchParams.get("subject");

  const [metadata, setMetadata] = useState<ExamMetadata | null>(null);
  const [marksheet, setMarksheet] = useState<MarksheetSchema | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [gradeResult, setGradeResult] = useState<GradeResult | null>(null);
  const [questionResults, setQuestionResults] = useState<QuestionResultMap>({});
  const [studentGoals, setStudentGoals] = useState<StudentGoal[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [layoutMode, setLayoutMode] = useState<PdfLayoutMode>("single");
  const [selectedProblemPath, setSelectedProblemPath] = useState("problem.pdf");
  const [pdfZoom, setPdfZoom] = useState(100);
  const [timeLimitFactor, setTimeLimitFactor] = useState<TimeLimitFactor>("1");
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([]);

  const [timerRunning, setTimerRunning] = useState(false);
  const [timerStarted, setTimerStarted] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const pdfScrollRef = useRef<HTMLDivElement | null>(null);

  const timeLimitSeconds = useMemo(() => {
    if (!metadata?.time_minutes) return 0;
    return Math.round(metadata.time_minutes * Number(timeLimitFactor) * 60);
  }, [metadata?.time_minutes, timeLimitFactor]);

  useEffect(() => {
    if (timeLimitSeconds > 0 && !timerStarted) {
      setRemainingSeconds(timeLimitSeconds);
    }
  }, [timeLimitSeconds, timerStarted]);

  useEffect(() => {
    const requestedPdf = searchParams.get("pdf");
    if (requestedPdf) {
      setSelectedProblemPath(requestedPdf);
      return;
    }
    const defaultPdfPath = shouldShowProblemPdf(metadata)
      ? metadata?.problem_files?.[0]?.path ?? "problem.pdf"
      : metadata?.answer_files?.[0]?.path ?? "answer.pdf";
    setSelectedProblemPath(defaultPdfPath);
  }, [metadata, searchParams]);

  useEffect(() => {
    const requestedPdf = searchParams.get("pdf");
    if (!requestedPdf) return;
    setSelectedProblemPath(requestedPdf);
  }, [searchParams]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
    const scrollArea = pdfScrollRef.current;
    if (!scrollArea) return;
    scrollArea.scrollTo({ top: 0, left: 0 });
  }, [examId, selectedProblemPath, layoutMode]);

  useEffect(() => {
    if (timerRunning && remainingSeconds > 0) {
      intervalRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            setTimerRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timerRunning, remainingSeconds]);

  const startTimer = useCallback(() => {
    stopBgm();
    setTimerRunning(true);
    setTimerStarted(true);
  }, [stopBgm]);

  const pauseTimer = useCallback(() => {
    setTimerRunning(false);
  }, []);

  const resetTimer = useCallback(() => {
    setTimerRunning(false);
    if (timeLimitSeconds > 0) {
      setRemainingSeconds(timeLimitSeconds);
    }
    setTimerStarted(false);
  }, [timeLimitSeconds]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setAuthChecked(true));

    fetch(`/api/files/${examId}/metadata.json`)
      .then((res) => res.json())
      .then((data) => setMetadata(data))
      .catch((err) => console.error("Failed to load metadata", err));

    fetch(`/api/files/${examId}/marksheet.json`)
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as MarksheetSchema;
      })
      .then((data) => setMarksheet(data))
      .catch(() => setMarksheet(null));
  }, [examId]);

  useEffect(() => {
    if (!marksheet?.selectionGroups?.length) {
      setSelectedSectionIds([]);
      return;
    }

    const selectionGroups = marksheet.selectionGroups;
    setSelectedSectionIds((current) => {
      const validSections = new Set(selectionGroups.flatMap((group) => group.sectionIds));
      const kept = current.filter((sectionId) => validSections.has(sectionId));
      if (kept.length > 0) return [...resolveSelectedSectionIds(marksheet, kept)];
      return selectionGroups.flatMap((group) => group.sectionIds.slice(0, getSelectionBounds(group).maxSelect));
    });
  }, [marksheet]);

  useEffect(() => {
    if (!user?.id) return;

    fetch(`/api/student-goals?studentId=${user.id}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setStudentGoals(Array.isArray(data) ? (data as StudentGoal[]) : []))
      .catch(() => setStudentGoals([]));
  }, [user?.id]);

  const selectableSectionIds = useMemo(
    () => new Set(marksheet?.selectionGroups?.flatMap((group) => group.sectionIds) ?? []),
    [marksheet],
  );
  const activeQuestionIds = useMemo(() => {
    if (!marksheet) return new Set<string>();
    return new Set(getActiveQuestions(marksheet, selectedSectionIds).map((question) => question.id));
  }, [marksheet, selectedSectionIds]);
  const selectionComplete = useMemo(() => {
    if (!marksheet?.selectionGroups?.length) return true;
    const selected = new Set(selectedSectionIds);
    return marksheet.selectionGroups.every((group) => {
      const { minSelect, maxSelect } = getSelectionBounds(group);
      const count = group.sectionIds.filter((sectionId) => selected.has(sectionId)).length;
      return count >= minSelect && count <= maxSelect;
    });
  }, [marksheet, selectedSectionIds]);
  const totalQuestions = activeQuestionIds.size;
  const answeredCount = useMemo(() => {
    if (!marksheet) return 0;
    return getAnsweredCount(
      marksheet.questions.filter((question) => activeQuestionIds.has(question.id)),
      answers,
    );
  }, [activeQuestionIds, answers, marksheet]);
  const questionGroups = useMemo(() => {
    if (!marksheet) return [];

    return marksheet.questions.reduce<Array<{ key: string; label: string | null; questions: typeof marksheet.questions }>>(
      (groups, question, index) => {
        if (marksheet.selectionGroups?.length && question.sectionId && selectableSectionIds.has(question.sectionId) && !selectedSectionIds.includes(question.sectionId)) {
          return groups;
        }
        if (!activeQuestionIds.has(question.id)) return groups;
        const rawLabel = question.prompt?.trim() ?? "";
        const groupLabel = question.sectionTitle ?? (/^\u7b2c\d+\u554f/.test(rawLabel) ? rawLabel : null);
        const key = question.sectionId ?? groupLabel ?? `question-${question.id}-${index}`;
        const current = groups[groups.length - 1];

        if (groupLabel && current && current.key === key) {
          current.questions.push(question);
          return groups;
        }

        groups.push({
          key,
          label: groupLabel,
          questions: [question],
        });
        return groups;
      },
      []
    );
  }, [activeQuestionIds, marksheet, selectableSectionIds, selectedSectionIds]);
  const unorderedQuestionIds = useMemo(() => {
    if (!marksheet?.scoringRules?.length) return new Set<string>();
    return new Set(
      marksheet.scoringRules
        .filter((rule) => rule.orderMatters === false)
        .flatMap((rule) => rule.questionIds),
    );
  }, [marksheet]);
  const groupedScoringByQuestionId = useMemo(() => {
    const grouped = new Map<string, MarksheetScoringRule>();
    marksheet?.scoringRules
      ?.filter((rule) => rule.questionIds.length > 1)
      .forEach((rule) => {
        rule.questionIds.forEach((questionId) => grouped.set(questionId, rule));
      });
    return grouped;
  }, [marksheet]);

  const allAnswered = selectionComplete && totalQuestions > 0 && answeredCount === totalQuestions;
  const hasMarksheet = Boolean(marksheet);
  const choicesPerRow = marksheet?.choicesPerRow ?? 5;
  const pdfBaseWidth = hasMarksheet
    ? layoutMode === "spread"
      ? 540
      : 900
    : layoutMode === "spread"
      ? 700
      : 1180;
  const pdfPageWidth = Math.round(pdfBaseWidth * (pdfZoom / 100));
  const displayTitle = buildExamDisplayTitle(metadata, examId, selectedSubject);
  const availableProblemFiles: ExamPdfFile[] = !shouldShowProblemPdf(metadata) ? [] : metadata?.problem_files?.length
    ? metadata.problem_files.map((file) => ({ ...file, kind: "problem" }))
    : [{ label: "問題", path: "problem.pdf", kind: "problem" }];
  const availableAnswerFiles: ExamPdfFile[] = metadata?.answer_files?.length
    ? metadata.answer_files.map((file) => ({ ...file, kind: "answer" }))
    : [{ label: "解答解説", path: "answer.pdf", kind: "answer" }];
  const availablePdfFiles = [...availableProblemFiles];
  availableAnswerFiles.forEach((file) => {
    if (!availablePdfFiles.some((existing) => existing.path === file.path)) {
      availablePdfFiles.push(file);
    }
  });
  const isCommonListeningExam =
    metadata?.subject === "english_listening" &&
    (metadata.exam_type === "common" ||
      metadata.exam_type === "common_retake" ||
      examId.startsWith("common/") ||
      examId.startsWith("common_retake/"));
  const listeningAudioFiles = metadata?.listening_audio ?? [];
  const goalGaps = useMemo<GoalGap[]>(() => {
    if (!gradeResult || gradeResult.maxScore <= 0) return [];

    const currentScore100 = Number(((gradeResult.score / gradeResult.maxScore) * 100).toFixed(1));
    return studentGoals.map((goal) => {
      const gap = Number(Math.max(goal.bRate - currentScore100, 0).toFixed(1));
      return {
        id: goal.id,
        label: [goal.university, goal.faculty, goal.department, goal.method, goal.schedule]
          .filter(Boolean)
          .join(" / "),
        bRate: goal.bRate,
        currentScore100,
        gap,
        reached: currentScore100 >= goal.bRate,
      };
    });
  }, [gradeResult, studentGoals]);

  const backFallbackPath = useMemo(() => {
    if (metadata?.exam_type === "common" || metadata?.exam_type === "common_retake" || examId.startsWith("common/") || examId.startsWith("common_retake/")) return "/practice/common";
    const [examType, year] = examId.split("/");
    if (["todai", "kyodai", "nagoya", "hamamatsu_medical", "secondary"].includes(metadata?.exam_type ?? examType)) {
      return `/practice/secondary?university=${encodeURIComponent(metadata?.exam_type ?? examType)}&year=${encodeURIComponent(
        String(metadata?.year ?? year ?? "")
      )}`;
    }
    if (metadata?.exam_type === "secondary" || examId.startsWith("secondary/")) return "/practice/secondary";
    return "/practice";
  }, [examId, metadata?.exam_type, metadata?.year]);

  const handleBack = useCallback(() => {
    const [examType, year] = examId.split("/");
    if (metadata?.exam_type === "common_retake" || examId.startsWith("common_retake/")) {
      router.push("/practice/common?mode=reinforcement");
      return;
    }

    if (["todai", "kyodai", "nagoya", "hamamatsu_medical", "secondary"].includes(metadata?.exam_type ?? examType)) {
      router.push(`/practice/secondary?university=${encodeURIComponent(metadata?.exam_type ?? examType)}&year=${encodeURIComponent(
        String(metadata?.year ?? year ?? "")
      )}`);
      return;
    }

    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(backFallbackPath);
  }, [backFallbackPath, examId, metadata?.exam_type, metadata?.year, router]);

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const getTimerColor = () => {
    if (!timeLimitSeconds) return "text-slate-300";
    const ratio = remainingSeconds / timeLimitSeconds;
    if (remainingSeconds === 0) return "text-red-500";
    if (ratio <= 1 / 60) return "text-red-500 animate-pulse";
    if (remainingSeconds <= 300) return "text-red-400";
    if (remainingSeconds <= 1800) return "text-amber-400";
    return "text-emerald-400";
  };

  const getTimerBorderColor = () => {
    if (!timeLimitSeconds) return "border-white/10";
    const ratio = remainingSeconds / timeLimitSeconds;
    if (remainingSeconds === 0) return "border-red-500/40 bg-red-500/10";
    if (ratio <= 1 / 60) return "border-red-500/40 bg-red-500/10";
    if (remainingSeconds <= 300) return "border-red-400/30 bg-red-400/5";
    if (remainingSeconds <= 1800) return "border-amber-400/30 bg-amber-400/5";
    return "border-emerald-400/20 bg-emerald-400/5";
  };

  const selectAnswer = (questionId: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
    setGradeResult(null);
    setQuestionResults({});
    setSaveMessage("");
  };

  const toggleSection = (sectionId: string, groupId: string) => {
    if (!marksheet?.selectionGroups?.length) return;
    const group = marksheet.selectionGroups.find((item) => item.id === groupId);
    if (!group) return;

    setSelectedSectionIds((current) => {
      const selected = new Set(current);
      if (selected.has(sectionId)) {
        selected.delete(sectionId);
        return [...selected];
      }

      const selectedInGroup = group.sectionIds.filter((item) => selected.has(item));
      if (selectedInGroup.length >= getSelectionBounds(group).maxSelect) return current;
      selected.add(sectionId);
      return [...selected];
    });
    setGradeResult(null);
    setQuestionResults({});
    setSaveMessage("");
  };

  const handleGrade = async () => {
    if (!marksheet || !user || user.role !== "student" || !allAnswered) return;

    setSubmitting(true);
    setSaveMessage("");

    try {
      const computed = marksheet.questions.reduce(
        (acc) => acc,
        {
          score: 0,
          maxScore: 0,
          correctCount: 0,
          totalQuestions: marksheet.questions.length,
        } satisfies GradeResult
      );

      const selected = new Set(selectedSectionIds);
      const scoringRules = buildEffectiveScoringRules(marksheet).filter((rule) =>
        rule.questionIds.every((questionId) => activeQuestionIds.has(questionId)) &&
        (!rule.sectionId || !selectableSectionIds.has(rule.sectionId) || selected.has(rule.sectionId))
      );
      const perQuestionResults: QuestionResultMap = {};

      scoringRules.forEach((rule) => {
        computed.maxScore += rule.points;
        const actual = rule.questionIds.map((questionId) => answers[questionId] ?? "");
        const prerequisitesMet = (rule.requires ?? []).every(
          (requirement) => answers[requirement.questionId] === requirement.value,
        );
        const fullyMatched = prerequisitesMet && matchesScoringRule(rule, actual);
        const awardedPoints = prerequisitesMet ? getAwardedPoints(rule, actual) : 0;
        if (awardedPoints > 0) {
          computed.score += awardedPoints;
          if (fullyMatched) computed.correctCount += 1;
        }

        const isCorrectForDisplay = prerequisitesMet && isRuleCorrectForDisplay(rule, actual);
        rule.questionIds.forEach((questionId) => {
          perQuestionResults[questionId] = isCorrectForDisplay;
        });
      });

      marksheet.questions.forEach((question) => {
        if (question.id in perQuestionResults) return;
        if (!hasAnswerValue(question.correctAnswer)) return;
        perQuestionResults[question.id] = String(question.correctAnswer) === (answers[question.id] ?? "");
      });

      setQuestionResults(perQuestionResults);

      const content = JSON.stringify(
        {
          mode: "marksheet",
          answers,
          selectedSectionIds,
        },
        null,
        2
      );
      const timestamp = new Date().toISOString();
      const submissionId = `demo-${user.id}-${Date.now()}`;

      setGradeResult(computed);
      const formData = new FormData();
      formData.append("examId", examId);
      formData.append("submissionId", submissionId);
      formData.append("content", content);
      formData.append("timestamp", timestamp);
      formData.append("studentId", user.id);

      const submitRes = await fetch("/api/submit", {
        method: "POST",
        body: formData,
      });

      if (!submitRes.ok) {
        throw new Error("Failed to save submission");
      }

      const submitData = (await submitRes.json()) as { submissionId: string };

      const gradeRes = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examId,
          submissionId: submitData.submissionId,
          score: computed.score,
          maxScore: computed.maxScore,
          feedback: buildAutoFeedback(computed),
        }),
      });

      if (!gradeRes.ok) {
        throw new Error("Failed to save grade");
      }

      setSaveMessage("自動採点が完了しました。結果も保存済みです。");
    } catch (error) {
      console.error(error);
      setSaveMessage("採点結果の保存に失敗しました。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col lg:h-[calc(100vh-64px)]">
      <div className="sticky top-[96px] z-40 flex shrink-0 flex-col gap-2 border-b border-white/5 bg-background/90 px-4 py-2 shadow-[0_14px_30px_rgba(0,0,0,0.22)] backdrop-blur-md md:flex-row md:items-center md:justify-between md:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={handleBack}
            className="text-muted-foreground transition-colors hover:text-accent"
            aria-label="前の画面に戻る"
          >
            <ArrowLeft className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-slate-700 bg-slate-900/70 p-1 text-[13px]">
            <button
              type="button"
              onClick={() => setLayoutMode("single")}
              className={`rounded-full px-3 py-1.5 font-bold transition-colors ${
                layoutMode === "single" ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              PDF 1枚表示
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode("spread")}
              className={`rounded-full px-3 py-1.5 font-bold transition-colors ${
                layoutMode === "spread" ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              PDF 2枚表示
            </button>
          </div>

          {metadata?.time_minutes && (
            <div className={`flex flex-wrap items-center gap-2 rounded-full border px-3 py-1.5 transition-colors ${getTimerBorderColor()}`}>
              <Timer className={`h-3.5 w-3.5 ${getTimerColor()}`} />
              <span className={`text-lg font-bold tracking-wider ${getTimerColor()} font-mono tabular-nums transition-colors`}>
                {formatTime(remainingSeconds)}
              </span>
              <select
                value={timeLimitFactor}
                onChange={(event) => {
                  const nextFactor = event.target.value as TimeLimitFactor;
                  setTimeLimitFactor(nextFactor);
                  setTimerRunning(false);
                  setTimerStarted(false);
                  if (metadata?.time_minutes) {
                    setRemainingSeconds(Math.round(metadata.time_minutes * Number(nextFactor) * 60));
                  }
                }}
                className="rounded-full border border-white/10 bg-slate-950 px-2 py-1 text-[11px] font-bold text-slate-100 outline-none transition-colors hover:border-white/20"
                title="制限時間"
              >
                <option value="1">標準</option>
                <option value="0.9">0.9倍</option>
                <option value="0.8">0.8倍</option>
              </select>
              <div className="ml-0.5 flex items-center gap-0.5">
                {!timerRunning ? (
                  <button
                    onClick={startTimer}
                    disabled={remainingSeconds === 0}
                    className="rounded-full p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-emerald-400 disabled:opacity-30"
                    title="開始"
                  >
                    <Play className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    onClick={pauseTimer}
                    className="rounded-full p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-amber-400"
                    title="一時停止"
                  >
                    <Pause className="h-4 w-4" />
                  </button>
                )}
                {timerStarted && (
                  <button
                    onClick={resetTimer}
                    className="rounded-full p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-red-400"
                    title="リセット"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden pt-2 lg:flex-row">
        <div className={`relative flex min-h-[60vh] flex-1 flex-col bg-zinc-950 ${hasMarksheet ? "border-r border-white/5" : ""}`}>
          <div className="sticky top-0 z-30 shrink-0 border-b border-white/5 bg-zinc-950/95 px-3 pb-3 pt-3 shadow-[0_14px_30px_rgba(0,0,0,0.32)] backdrop-blur-md md:px-5">
            <div className="mx-auto w-full max-w-[1700px]">
              <div className="flex flex-wrap items-center gap-2">
                <div className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                  <p className="whitespace-nowrap text-[13px] font-bold tracking-tight text-white md:text-sm">
                    {displayTitle}
                  </p>
                </div>
                {availablePdfFiles.length > 1 ? (
                  <div className="flex shrink-0 gap-2">
                    {availablePdfFiles.map((file) => {
                      const active = selectedProblemPath === file.path;
                      return (
                        <button
                          key={file.path}
                          type="button"
                          onClick={() => setSelectedProblemPath(file.path)}
                          className={`rounded-full px-3.5 py-1.5 text-[13px] font-bold transition ${
                            active
                              ? "bg-blue-500 text-white shadow-[0_10px_30px_rgba(59,130,246,0.35)]"
                              : file.kind === "answer"
                                ? "bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25"
                                : "bg-white/10 text-slate-200 hover:bg-white/20"
                          }`}
                        >
                          {file.label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
                {isCommonListeningExam ? (
                  <div className="flex shrink-0 items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-1 text-cyan-50">
                    <Headphones className="h-4 w-4 text-cyan-200" />
                    {listeningAudioFiles.length > 0 ? (
                      listeningAudioFiles.map((file) =>
                        isDirectAudioUrl(file) ? (
                          <audio
                            key={file.url}
                            controls
                            preload="none"
                            src={file.url}
                            className="h-8 w-[220px] max-w-[45vw]"
                            aria-label={file.label}
                          />
                        ) : (
                          <a
                            key={file.url}
                            href={file.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-full bg-cyan-400 px-3 py-1.5 text-[13px] font-black text-slate-950 transition hover:bg-cyan-300"
                            title={file.label}
                          >
                            リスニングを聞く
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ),
                      )
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-full bg-slate-700 px-3 py-1.5 text-[13px] font-black text-slate-300 opacity-80"
                        title="リスニング音声は未登録です"
                      >
                        リスニング音声未登録
                      </button>
                    )}
                  </div>
                ) : null}
                <div className="ml-auto flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1">
                  <span className="px-2 text-[11px] font-bold tracking-[0.18em] text-slate-300">
                    {pdfZoom}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setPdfZoom((current) => Math.max(PDF_ZOOM_MIN, current - PDF_ZOOM_STEP))}
                    disabled={pdfZoom <= PDF_ZOOM_MIN}
                    className="rounded-full border border-white/10 p-1.5 text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                    title="PDFを縮小"
                    aria-label="PDFを縮小"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPdfZoom(100)}
                    className="rounded-full px-2 py-1 text-[11px] font-bold text-slate-200 transition hover:bg-white/10"
                    title="倍率を100%に戻す"
                  >
                    100
                  </button>
                  <button
                    type="button"
                    onClick={() => setPdfZoom((current) => Math.min(PDF_ZOOM_MAX, current + PDF_ZOOM_STEP))}
                    disabled={pdfZoom >= PDF_ZOOM_MAX}
                    className="rounded-full border border-white/10 p-1.5 text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                    title="PDFを拡大"
                    aria-label="PDFを拡大"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div ref={pdfScrollRef} className="flex-1 overflow-auto px-3 py-2 md:px-5 md:py-3">
            <div className="mx-auto w-full max-w-[1700px]">
              <PdfViewer
                fileUrl={`/exam-assets/${examId}/${selectedProblemPath}`}
                pagesPerRow={layoutMode === "spread" ? 2 : 1}
                pageWidth={pdfPageWidth}
              />
            </div>
          </div>
        </div>

        {hasMarksheet && (
        <div className="flex w-full flex-col overflow-y-auto bg-background lg:w-[460px]">
          <div className="flex flex-1 flex-col p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold">マークシート解答</h3>
              <p className="mt-2 text-sm text-slate-400">
                左に問題、右に解答欄を固定したまま進められます。
              </p>
            </div>

            {marksheet ? (
              <>
                <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-300">
                  <p className="font-bold text-white">{marksheet.title ?? "解答用マークシート"}</p>
                  <p className="mt-1">{marksheet.instructions ?? "全問回答すると採点ボタンが押せます。"}</p>
                  <p className="mt-2 text-xs text-slate-400">
                    回答済み: {answeredCount} / {totalQuestions}
                  </p>
                </div>

                {gradeResult && (
                  <div className="mb-4 rounded-2xl border border-sky-200 bg-[linear-gradient(135deg,#eff6ff_0%,#ecfeff_100%)] p-5 shadow-sm">
                    <p className="text-xs font-bold tracking-[0.24em] text-sky-700">SCORE</p>
                    <p className="mt-2 text-3xl font-black text-slate-950">
                      {gradeResult.score}
                      <span className="text-lg text-slate-600"> / {gradeResult.maxScore} 点</span>
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      {gradeResult.correctCount} / {gradeResult.totalQuestions} 問正解
                    </p>
                  </div>
                )}

                {saveMessage && (
                  <div className="mb-4 flex items-start gap-3 rounded-lg border border-blue-500/20 bg-blue-500/10 p-4 text-sm text-blue-100">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>{saveMessage}</p>
                  </div>
                )}

                {!authChecked || (user && user.role === "student") ? null : (
                  <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>採点するには生徒アカウントでログインしてください。</p>
                  </div>
                )}
                {marksheet.selectionGroups?.length ? (
                  <div className="mb-4 space-y-3 rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                    {marksheet.selectionGroups.map((group) => {
                      const { maxSelect } = getSelectionBounds(group);
                      const selectedCount = group.sectionIds.filter((sectionId) => selectedSectionIds.includes(sectionId)).length;
                      return (
                        <div key={group.id}>
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <p className="text-sm font-black text-slate-100">{group.title}</p>
                            <p className="text-xs font-bold text-slate-400">
                              {selectedCount} / {maxSelect}
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {group.sectionIds.map((sectionId) => {
                              const checked = selectedSectionIds.includes(sectionId);
                              const sectionTitle =
                                marksheet.questions.find((question) => question.sectionId === sectionId)?.sectionTitle ?? sectionId;
                              return (
                                <button
                                  key={sectionId}
                                  type="button"
                                  onClick={() => toggleSection(sectionId, group.id)}
                                  className={`rounded-xl border px-3 py-2 text-sm font-black transition ${
                                    checked
                                      ? "border-sky-300 bg-sky-500 text-white"
                                      : "border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500"
                                  }`}
                                >
                                  {sectionTitle}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                <div className="flex-1 space-y-4 overflow-y-auto pr-1">
                  {questionGroups.map((group) => (
                    <div
                      key={group.key}
                      className={group.label ? "rounded-2xl border border-slate-800/90 bg-slate-950/50 p-3" : "space-y-4"}
                    >
                      {group.label && (
                        <div className="sticky top-0 z-10 mb-3 rounded-xl border border-slate-700/70 bg-slate-900/95 px-3 py-2 shadow-[0_10px_24px_rgba(0,0,0,0.28)] backdrop-blur">
                          <p className="text-sm font-black tracking-wide text-slate-100">{group.label}</p>
                        </div>
                      )}

                      <div className="space-y-4">
                        {group.questions.map((question) => {
                          const groupedRule = groupedScoringByQuestionId.get(question.id);
                          return (
                            <section
                              key={question.id}
                              className="grid grid-cols-[72px_minmax(0,1fr)] items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3"
                            >
                            <div className="pt-1 text-center">
                              {group.label && (
                                <p className="mb-1 inline-flex rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-black text-slate-300">
                                  {group.label}
                                </p>
                              )}
                              <p className="text-[11px] font-semibold tracking-[0.2em] text-slate-200">{"\u89e3\u7b54\u8a18\u53f7"}</p>
                              <p className="mt-1 text-lg font-black text-slate-50">
                                {question.displayLabel ?? question.number}
                              </p>
                              {unorderedQuestionIds.has(question.id) && (
                                <span className="mt-1 inline-flex rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-[10px] font-black text-amber-200">
                                  順不同
                                </span>
                              )}
                              {groupedRule && (
                                <span className="mt-1 inline-flex rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-black text-cyan-200">
                                  全て正解で{groupedRule.points}点
                                </span>
                              )}
                              {typeof questionResults[question.id] === "boolean" && (
                                <span
                                  className={`mt-2 inline-flex rounded-full px-2 py-1 text-[11px] font-black ${
                                    questionResults[question.id]
                                      ? "bg-emerald-500/20 text-emerald-300"
                                      : "bg-red-500/20 text-red-300"
                                  }`}
                                >
                                  {questionResults[question.id] ? "○" : "×"}
                                </span>
                              )}
                            </div>

                            <div
                              className="grid gap-1.5"
                              style={{
                                gridTemplateColumns: `repeat(${Math.min(
                                  choicesPerRow,
                                  (marksheet.defaultChoices ?? question.choices ?? []).length
                                )}, minmax(0, 1fr))`,
                              }}
                            >
                              {(marksheet.defaultChoices ?? question.choices ?? []).map((choice) => {
                                const selected = answers[question.id] === choice.value;
                                return (
                                  <button
                                    key={choice.value}
                                    type="button"
                                    onClick={() => selectAnswer(question.id, choice.value)}
                                    aria-pressed={selected}
                                    className={`flex h-10 min-w-0 items-center justify-center rounded-full border-2 text-sm font-black transition-all ${
                                      selected
                                        ? "border-sky-300 bg-sky-500 text-white shadow-[0_0_0_3px_rgba(14,165,233,0.22)]"
                                        : "border-slate-500 bg-slate-950 text-slate-100 hover:border-slate-300"
                                    }`}
                                  >
                                    {choice.label}
                                  </button>
                                );
                              })}
                            </div>
                            </section>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => void handleGrade()}
                  disabled={submitting || !allAnswered || !user || user.role !== "student"}
                  className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-3 font-bold text-white transition-all hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-400"
                >
                  {submitting ? "採点中..." : "全部の選択肢を確定して採点"}
                </button>

                {gradeResult && (
                  <div className="mt-3 rounded-2xl border border-sky-200 bg-[linear-gradient(135deg,#f8fbff_0%,#eef8ff_100%)] px-4 py-4 shadow-sm">
                    <p className="text-xs font-bold tracking-[0.22em] text-sky-700">採点完了</p>
                    <p className="mt-2 text-2xl font-black text-slate-950">
                      {gradeResult.score}
                      <span className="text-base text-slate-600"> / {gradeResult.maxScore} 点</span>
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      結果の確認画面で各設問の正誤を見られます。
                    </p>
                  </div>
                )}

                {goalGaps.length > 0 && (
                  <div className="mt-3 rounded-2xl border border-violet-200 bg-[linear-gradient(135deg,#faf5ff_0%,#f5f3ff_100%)] px-4 py-4 shadow-sm">
                    <p className="text-xs font-bold tracking-[0.22em] text-violet-700">志望校判定</p>
                    <div className="mt-3 space-y-3">
                      {goalGaps.map((goal) => (
                        <div key={goal.id} className="rounded-xl border border-violet-100 bg-white/90 px-3 py-3">
                          <p className="text-sm font-black text-slate-950">{goal.label}</p>
                          <p className="mt-1 text-xs text-slate-500">B判定基準 {goal.bRate.toFixed(1)}点 / 100点換算</p>
                          <p className={`mt-2 text-lg font-black ${goal.reached ? "text-emerald-700" : "text-violet-700"}`}>
                            {goal.reached ? `B判定基準を ${Math.abs(goal.currentScore100 - goal.bRate).toFixed(1)} 点上回っています` : `あと ${goal.gap.toFixed(1)} 点`}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                <p className="font-bold">この試験にはマークシート定義がまだありません。</p>
                <p className="mt-2">
                  `marksheet.json` を追加すると、右側の選択肢ボタンと自動採点が有効になります。
                </p>
              </div>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
