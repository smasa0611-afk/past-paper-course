"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ClipboardList, Crown, LogIn, Medal, Search, Target, Trophy, TrendingUp } from "lucide-react";
import { useBgm } from "@/components/BgmProvider";
import type { ExamMetadata } from "@/types/exam";
import type { SecondaryTargetKey } from "@/types/secondary";

type User = { id: string; name: string; role: "student" | "teacher" };
type Student = { id: string; displayName: string; nickname?: string; campus?: string };
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

type RankingEntry = {
  rank: number;
  studentId: string;
  name: string;
  campus: string;
  score: number;
  maxScore?: number;
  executedAt: string;
  examTitle: string;
  unitLabel?: string;
  subLabel?: string;
};

const OVERALL_SUBJECT_KEY = "overall";
const OVERALL_MAX_SCORE = 1000;
type RankingStage = "common" | "secondary";
type SecondaryRankingMode = "score" | "progress";

const secondaryTargets: { key: SecondaryTargetKey; label: string; courseLabel: string }[] = [
  { key: "todai", label: "東大", courseLabel: "東大2次コース" },
  { key: "kyodai", label: "京大", courseLabel: "京大2次コース" },
  { key: "nagoya", label: "名大", courseLabel: "名大2次コース" },
  { key: "hamamatsu_medical", label: "浜医", courseLabel: "浜医2次コース" },
];

const secondarySubjects = [
  { key: "all", label: "すべて" },
  { key: "english", label: "英語" },
  { key: "math", label: "数学" },
  { key: "japanese", label: "国語" },
  { key: "physics", label: "物理" },
  { key: "chemistry", label: "化学" },
  { key: "biology", label: "生物" },
  { key: "essay", label: "小論文" },
  { key: "interview", label: "面接" },
];

const socialSubjects = new Set([
  "world_history",
  "japanese_history",
  "geography",
  "integrated_history_public",
  "public_ethics",
  "public_politics_economy",
  "world_history_a",
  "world_history_b",
  "japanese_history_a",
  "japanese_history_b",
  "geography_a",
  "geography_b",
  "modern_society",
  "ethics",
  "politics_economy",
  "ethics_politics_economy",
]);

const scienceSubjects = new Set([
  "physics",
  "chemistry",
  "biology",
  "earth_science",
  "science_basics",
  "physics_basics",
  "chemistry_basics",
  "biology_basics",
  "earth_science_basics",
]);

const commonSubjects = [
  { key: OVERALL_SUBJECT_KEY, label: "総合（6教科8科目・1000点）" },
  { key: "all", label: "すべて" },
  { key: "english", label: "英語" },
  { key: "english_listening", label: "英語リスニング" },
  { key: "japanese", label: "国語" },
  { key: "math_ia", label: "数学IA" },
  { key: "math_iibc", label: "数学IIBC" },
  { key: "world_history", label: "世界史" },
  { key: "japanese_history", label: "日本史" },
  { key: "geography", label: "地理" },
  { key: "civics", label: "公民" },
  { key: "physics", label: "物理" },
  { key: "chemistry", label: "化学" },
  { key: "biology", label: "生物" },
];

const years10 = Array.from({ length: 10 }, (_, index) => 2026 - index);

function defaultPeriodStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function defaultPeriodEnd() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function getOverallSlot(subject: string) {
  if (subject === "japanese") return { key: "japanese", maxScore: 200 };
  if (subject === "english") return { key: "english", maxScore: 100 };
  if (subject === "english_listening") return { key: "english_listening", maxScore: 100 };
  if (subject === "math_ia") return { key: "math_ia", maxScore: 100 };
  if (subject === "math_iibc" || subject === "math_iib") return { key: "math_iibc", maxScore: 100 };
  if (subject === "information_i" || subject === "information_related_basics") return { key: "information", maxScore: 100 };
  if (socialSubjects.has(subject)) return { key: `social:${subject}`, group: "social", maxScore: 100 };
  if (scienceSubjects.has(subject)) return { key: `science:${subject}`, group: "science", maxScore: 100 };
  return null;
}

function normalizeScoreToMax(score: number, maxScore: number | undefined, targetMax: number) {
  if (typeof maxScore === "number" && maxScore > 0) {
    return Math.min(targetMax, Math.max(0, (score / maxScore) * targetMax));
  }

  return Math.min(targetMax, Math.max(0, score));
}

function roundScore(score: number) {
  return Math.round(score * 10) / 10;
}

function normalizeCampus(campus?: string | null) {
  const trimmed = (campus ?? "").trim();
  return trimmed.length > 0 ? trimmed : "未設定";
}

function rankingDisplayName(_studentId: string, student?: Student) {
  return student?.displayName?.trim() || "ニックネーム未設定";
}

export default function RankingPage() {
  const { playEffect } = useBgm();
  const [user, setUser] = useState<User | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [exams, setExams] = useState<ExamMetadata[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [subscribedSecondaryTargets, setSubscribedSecondaryTargets] = useState<SecondaryTargetKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodFrom, setPeriodFrom] = useState(defaultPeriodStart());
  const [periodTo, setPeriodTo] = useState(defaultPeriodEnd());
  const [rankingStage, setRankingStage] = useState<RankingStage>("common");
  const [year, setYear] = useState("2026");
  const [subject, setSubject] = useState(OVERALL_SUBJECT_KEY);
  const [secondaryMode, setSecondaryMode] = useState<SecondaryRankingMode>("score");
  const [secondaryTarget, setSecondaryTarget] = useState<SecondaryTargetKey>("nagoya");
  const [secondaryYear, setSecondaryYear] = useState("2018");
  const [secondarySubject, setSecondarySubject] = useState("all");
  const [campusFilter, setCampusFilter] = useState<string>("all"); // all | mine | (campus name)
  const [bestCount, setBestCount] = useState<string>("10"); // "5" | "10"
  const [searchFilters, setSearchFilters] = useState<{
    stage: RankingStage;
    secondaryMode: SecondaryRankingMode;
    periodFrom: string;
    periodTo: string;
    year: string;
    subject: string;
    secondaryTarget: SecondaryTargetKey;
    secondaryYear: string;
    secondarySubject: string;
  } | null>(() => ({
    stage: "common",
    secondaryMode: "score",
    periodFrom: defaultPeriodStart(),
    periodTo: defaultPeriodEnd(),
    year: "2026",
    subject: OVERALL_SUBJECT_KEY,
    secondaryTarget: "nagoya",
    secondaryYear: "2018",
    secondarySubject: "all",
  }));

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then((res) => (res.ok ? res.json() : { user: null })),
      fetch("/api/students").then((res) => res.json()),
      fetch("/api/exams").then((res) => res.json()),
      fetch("/api/submissions?scope=ranking").then((res) => res.json()),
      fetch("/api/assignments").then((res) => (res.ok ? res.json() : [])),
      fetch("/api/secondary-access").then((res) => (res.ok ? res.json() : { subscribedTargetKeys: [] })),
    ])
      .then(([me, studentData, examData, submissionData, assignmentData, secondaryAccess]) => {
        setUser(me.user);
        setStudents(Array.isArray(studentData) ? studentData : []);
        setExams(Array.isArray(examData) ? examData : []);
        setSubmissions(Array.isArray(submissionData) ? submissionData : []);
        setAssignments(Array.isArray(assignmentData) ? assignmentData : []);
        setSubscribedSecondaryTargets(
          Array.isArray(secondaryAccess?.subscribedTargetKeys) ? secondaryAccess.subscribedTargetKeys : [],
        );
      })
      .catch(() => {
        setUser(null);
        setStudents([]);
        setExams([]);
        setSubmissions([]);
        setAssignments([]);
        setSubscribedSecondaryTargets([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const studentMap = useMemo(
    () => new Map(students.map((student) => [student.id, student])),
    [students]
  );

  const bestCountNumber = Number(bestCount) === 10 ? 10 : 5;

  const availableSecondaryTargets = useMemo(() => {
    if (user?.role === "teacher") return secondaryTargets;
    const subscribed = new Set(subscribedSecondaryTargets);
    return secondaryTargets.filter((target) => subscribed.has(target.key));
  }, [subscribedSecondaryTargets, user?.role]);

  const canUseSecondaryRanking = user?.role === "teacher" || availableSecondaryTargets.length > 0;

  const rankingSubmissions = useMemo(() => {
    const importedAssignments = assignments
      .filter((assignment) => typeof assignment.score === "number")
      .map((assignment) => ({
        id: `assignment-imported-${assignment.id}`,
        examId: assignment.examId,
        studentId: assignment.studentId,
        timestamp: assignment.submittedAt || assignment.importedAt || assignment.dueDate || new Date().toISOString(),
        status: "graded",
        score: assignment.score,
        maxScore: assignment.maxScore || 100,
        gradedAt: assignment.gradedAt,
      }) satisfies Submission);

    return [...submissions, ...importedAssignments];
  }, [assignments, submissions]);

  useEffect(() => {
    if (!user) return;
    if (!canUseSecondaryRanking && rankingStage === "secondary") {
      setRankingStage("common");
      return;
    }
    if (canUseSecondaryRanking && !availableSecondaryTargets.some((target) => target.key === secondaryTarget)) {
      setSecondaryTarget(availableSecondaryTargets[0]?.key ?? "todai");
    }
  }, [availableSecondaryTargets, canUseSecondaryRanking, rankingStage, secondaryTarget, user]);

  const myCampus = useMemo(() => {
    if (!user || user.role !== "student") return null;
    const me = studentMap.get(user.id);
    return normalizeCampus(me?.campus);
  }, [studentMap, user]);

  const campusOptions = useMemo(() => {
    const unique = Array.from(new Set(students.map((s) => normalizeCampus(s.campus))));
    unique.sort((a, b) => a.localeCompare(b, "ja-JP"));
    const options: { key: string; label: string }[] = [{ key: "all", label: "全校舎" }];

    options.push({
      key: "mine",
      label: myCampus ? `自分の校舎（${myCampus}）` : "自分の校舎",
    });

    for (const campus of unique) {
      if (myCampus && campus === myCampus) continue; // 重複表示を避ける
      options.push({ key: campus, label: campus });
    }

    return options;
  }, [myCampus, students]);

  const appliedFilters = useMemo(
    () =>
      searchFilters ?? {
        stage: rankingStage,
        secondaryMode,
        periodFrom,
        periodTo,
        year,
        subject,
        secondaryTarget,
        secondaryYear,
        secondarySubject,
      },
    [periodFrom, periodTo, rankingStage, searchFilters, secondaryMode, secondarySubject, secondaryTarget, secondaryYear, subject, year]
  );

  const filteredExams = useMemo(() => {
    return exams.filter((exam) => {
      if (exam.exam_type !== "common") return false;
      if (appliedFilters.year !== "all" && String(exam.year) !== appliedFilters.year) return false;
      if (
        appliedFilters.subject !== "all" &&
        appliedFilters.subject !== OVERALL_SUBJECT_KEY &&
        exam.subject !== appliedFilters.subject
      ) return false;
      return true;
    });
  }, [appliedFilters, exams]);

  const filteredSecondaryExams = useMemo(() => {
    return exams.filter((exam) => {
      if (exam.exam_type !== appliedFilters.secondaryTarget) return false;
      if (appliedFilters.secondaryYear !== "all" && String(exam.year) !== appliedFilters.secondaryYear) return false;
      if (appliedFilters.secondarySubject !== "all" && exam.subject !== appliedFilters.secondarySubject) return false;
      return true;
    });
  }, [appliedFilters.secondarySubject, appliedFilters.secondaryTarget, appliedFilters.secondaryYear, exams]);

  const secondaryYearOptions = useMemo(() => {
    const years = Array.from(
      new Set(exams.filter((exam) => exam.exam_type === secondaryTarget).map((exam) => String(exam.year))),
    ).sort((a, b) => Number(b) - Number(a));
    return [{ key: "all", label: "すべて" }, ...years.map((item) => ({ key: item, label: `${item}年` }))];
  }, [exams, secondaryTarget]);

  const secondarySubjectOptions = useMemo(() => {
    const subjects = new Set(
      exams
        .filter((exam) => exam.exam_type === secondaryTarget && (secondaryYear === "all" || String(exam.year) === secondaryYear))
        .map((exam) => exam.subject),
    );
    const options = secondarySubjects.filter((item) => item.key === "all" || subjects.has(item.key));
    return options.length > 1 ? options : secondarySubjects;
  }, [exams, secondaryTarget, secondaryYear]);

  const rankings = useMemo<RankingEntry[]>(() => {
    if (!searchFilters) return [];

    if (searchFilters.stage === "secondary") {
      const examIds = new Set(filteredSecondaryExams.map((exam) => exam.id));
      const examById = new Map(filteredSecondaryExams.map((exam) => [exam.id, exam]));
      const fromTime = new Date(`${searchFilters.periodFrom}T00:00:00`).getTime();
      const toTime = new Date(`${searchFilters.periodTo}T23:59:59`).getTime();

      const targetSubmissions = rankingSubmissions.filter((submission) => {
        if (submission.status !== "graded") return false;
        if (!examIds.has(submission.examId)) return false;
        if (typeof submission.score !== "number") return false;
        const executedTime = new Date(submission.timestamp).getTime();
        return executedTime >= fromTime && executedTime <= toTime;
      });

      if (searchFilters.secondaryMode === "progress") {
        const byStudent = new Map<string, { examIds: Set<string>; latest: number; subjects: Set<string> }>();

        targetSubmissions.forEach((submission) => {
          const exam = examById.get(submission.examId);
          const entryCampus = normalizeCampus(studentMap.get(submission.studentId)?.campus);
          if (campusFilter === "mine" && user?.role === "student" && myCampus && entryCampus !== myCampus) return;
          if (campusFilter !== "all" && campusFilter !== "mine" && entryCampus !== campusFilter) return;

          const current = byStudent.get(submission.studentId) ?? {
            examIds: new Set<string>(),
            latest: 0,
            subjects: new Set<string>(),
          };
          current.examIds.add(submission.examId);
          current.latest = Math.max(current.latest, new Date(submission.timestamp).getTime());
          if (exam) current.subjects.add(secondarySubjects.find((item) => item.key === exam.subject)?.label ?? exam.subject);
          byStudent.set(submission.studentId, current);
        });

        return [...byStudent.entries()]
          .map(([studentId, item]): RankingEntry => {
            const student = studentMap.get(studentId);
            return {
              rank: 0,
              studentId,
              name: rankingDisplayName(studentId, student),
              campus: normalizeCampus(student?.campus),
              score: item.examIds.size,
              executedAt: item.latest > 0 ? new Date(item.latest).toISOString() : searchFilters.periodTo,
              examTitle: `${secondaryTargets.find((target) => target.key === searchFilters.secondaryTarget)?.courseLabel ?? "大学別2次"} 演習量`,
              unitLabel: "回",
              subLabel: Array.from(item.subjects).slice(0, 3).join(" / ") || "科目未設定",
            };
          })
          .sort((a, b) => b.score - a.score || new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime())
          .slice(0, bestCountNumber)
          .map((entry, index) => ({ ...entry, rank: index + 1 }));
      }

      const latestByStudent = new Map<string, Submission>();

      targetSubmissions.forEach((submission) => {
        const existing = latestByStudent.get(submission.studentId);
        if (!existing || new Date(existing.timestamp).getTime() < new Date(submission.timestamp).getTime()) {
          latestByStudent.set(submission.studentId, submission);
        }
      });

      return [...latestByStudent.values()]
        .filter((submission) => {
          const entryCampus = normalizeCampus(studentMap.get(submission.studentId)?.campus);
          if (campusFilter === "all") return true;
          if (campusFilter === "mine") return user?.role === "student" && myCampus ? entryCampus === myCampus : true;
          return entryCampus === campusFilter;
        })
        .sort((a, b) => {
          const scoreDiff = Number(b.score ?? 0) - Number(a.score ?? 0);
          if (scoreDiff !== 0) return scoreDiff;
          return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        })
        .slice(0, bestCountNumber)
        .map((submission, index): RankingEntry => {
          const student = studentMap.get(submission.studentId);
          const exam = examById.get(submission.examId);

          return {
            rank: index + 1,
            studentId: submission.studentId,
            name: rankingDisplayName(submission.studentId, student),
            campus: normalizeCampus(student?.campus),
            score: Number(submission.score ?? 0),
            maxScore: typeof submission.maxScore === "number" ? submission.maxScore : undefined,
            executedAt: submission.timestamp,
            examTitle: exam?.title ?? submission.examId,
            unitLabel: "点",
            subLabel: secondaryTargets.find((target) => target.key === searchFilters.secondaryTarget)?.courseLabel,
          };
        });
    }

    const examIds = new Set(filteredExams.map((exam) => exam.id));
    const examById = new Map(filteredExams.map((exam) => [exam.id, exam]));
    const fromTime = new Date(`${searchFilters.periodFrom}T00:00:00`).getTime();
    const toTime = new Date(`${searchFilters.periodTo}T23:59:59`).getTime();

    if (searchFilters.subject === OVERALL_SUBJECT_KEY) {
      type SlotScore = {
        key: string;
        group?: string;
        score: number;
        timestamp: string;
        examTitle: string;
      };

      const latestByStudentAndSubject = new Map<string, Submission>();

      rankingSubmissions.forEach((submission) => {
        if (submission.status !== "graded") return;
        if (!examIds.has(submission.examId)) return;
        if (typeof submission.score !== "number") return;

        const exam = examById.get(submission.examId);
        if (!exam || !getOverallSlot(exam.subject)) return;

        const executedTime = new Date(submission.timestamp).getTime();
        if (executedTime < fromTime || executedTime > toTime) return;

        const key = `${submission.studentId}:${exam.subject}`;
        const existing = latestByStudentAndSubject.get(key);
        if (!existing || new Date(existing.timestamp).getTime() < executedTime) {
          latestByStudentAndSubject.set(key, submission);
        }
      });

      const groupedByStudent = new Map<string, SlotScore[]>();
      latestByStudentAndSubject.forEach((submission) => {
        const exam = examById.get(submission.examId);
        if (!exam) return;
        const slot = getOverallSlot(exam.subject);
        if (!slot) return;

        const score = normalizeScoreToMax(Number(submission.score ?? 0), submission.maxScore, slot.maxScore);
        const current = groupedByStudent.get(submission.studentId) ?? [];
        current.push({
          key: slot.key,
          group: slot.group,
          score,
          timestamp: submission.timestamp,
          examTitle: exam.title,
        });
        groupedByStudent.set(submission.studentId, current);
      });

      const candidateRankings = [...groupedByStudent.entries()].flatMap(([studentId, slots]) => {
        const entryCampus = normalizeCampus(studentMap.get(studentId)?.campus);
        if (campusFilter === "mine" && user?.role === "student" && myCampus && entryCampus !== myCampus) return [];
        if (campusFilter !== "all" && campusFilter !== "mine" && entryCampus !== campusFilter) return [];

        const fixedSlotMap = new Map<string, SlotScore>();
        slots.filter((slot) => !slot.group).forEach((slot) => {
          const existing = fixedSlotMap.get(slot.key);
          if (!existing || slot.score > existing.score || (slot.score === existing.score && new Date(slot.timestamp) > new Date(existing.timestamp))) {
            fixedSlotMap.set(slot.key, slot);
          }
        });
        const fixedSlots = [...fixedSlotMap.values()];
        const socialSlots = slots
          .filter((slot) => slot.group === "social")
          .sort((a, b) => b.score - a.score || new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 2);
        const scienceSlots = slots
          .filter((slot) => slot.group === "science")
          .sort((a, b) => b.score - a.score || new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 1);
        const selectedSlots = [...fixedSlots, ...socialSlots, ...scienceSlots];
        const score = roundScore(selectedSlots.reduce((sum, slot) => sum + slot.score, 0));
        const latestTimestamp = selectedSlots.reduce(
          (latest, slot) => Math.max(latest, new Date(slot.timestamp).getTime()),
          0,
        );
        const student = studentMap.get(studentId);

        return [{
          rank: 0,
          studentId,
          name: rankingDisplayName(studentId, student),
          campus: entryCampus,
          score,
          maxScore: OVERALL_MAX_SCORE,
          executedAt: latestTimestamp > 0 ? new Date(latestTimestamp).toISOString() : searchFilters.periodTo,
          examTitle: `${searchFilters.year === "all" ? "全年度" : `${searchFilters.year}年度`} 総合`,
        } satisfies RankingEntry];
      });

      return candidateRankings
        .sort((a, b) => {
          const scoreDiff = b.score - a.score;
          if (scoreDiff !== 0) return scoreDiff;
          return new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime();
        })
        .slice(0, bestCountNumber)
        .map((entry, index) => ({ ...entry, rank: index + 1 }));
    }

    const latestByStudent = new Map<string, Submission>();

    rankingSubmissions.forEach((submission) => {
      if (submission.status !== "graded") return;
      if (!examIds.has(submission.examId)) return;
      if (typeof submission.score !== "number") return;

      const executedTime = new Date(submission.timestamp).getTime();
      if (executedTime < fromTime || executedTime > toTime) return;

      const existing = latestByStudent.get(submission.studentId);
      if (!existing || new Date(existing.timestamp).getTime() < executedTime) {
        latestByStudent.set(submission.studentId, submission);
      }
    });

    const candidateSubmissions = [...latestByStudent.values()].filter((submission) => {
      const entryCampus = normalizeCampus(studentMap.get(submission.studentId)?.campus);
      if (campusFilter === "all") return true;
      if (campusFilter === "mine") {
        return user?.role === "student" && myCampus ? entryCampus === myCampus : true;
      }
      return entryCampus === campusFilter;
    });

    return candidateSubmissions
      .sort((a, b) => {
        const scoreDiff = Number(b.score ?? 0) - Number(a.score ?? 0);
        if (scoreDiff !== 0) return scoreDiff;
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      })
      .slice(0, bestCountNumber)
      .map((submission, index): RankingEntry => {
        const student = studentMap.get(submission.studentId);
        const exam = filteredExams.find((item) => item.id === submission.examId);

        return {
          rank: index + 1,
          studentId: submission.studentId,
          name: rankingDisplayName(submission.studentId, student),
          campus: normalizeCampus(student?.campus),
          score: Number(submission.score ?? 0),
          maxScore: typeof submission.maxScore === "number" ? submission.maxScore : undefined,
          executedAt: submission.timestamp,
          examTitle: exam?.title ?? submission.examId,
        };
      });
  }, [bestCountNumber, campusFilter, filteredExams, filteredSecondaryExams, myCampus, rankingSubmissions, searchFilters, studentMap, user?.role]);

  const rankingLabel = useMemo(() => {
    if (appliedFilters.stage === "secondary") {
      const target = secondaryTargets.find((item) => item.key === appliedFilters.secondaryTarget);
      const subjectLabel = secondarySubjects.find((item) => item.key === appliedFilters.secondarySubject)?.label ?? appliedFilters.secondarySubject;
      const yearLabel = appliedFilters.secondaryYear === "all" ? "全年度" : `${appliedFilters.secondaryYear}年度`;
      if (appliedFilters.secondaryMode === "progress") return `${target?.courseLabel ?? "大学別2次"} / ${yearLabel} / 演習量`;
      return `${target?.courseLabel ?? "大学別2次"} / ${yearLabel} / ${subjectLabel}`;
    }
    const titles = [...new Set(rankings.map((entry) => entry.examTitle).filter(Boolean))];
    if (titles.length === 1) return titles[0];
    if (titles.length > 1) return `${appliedFilters.year === "all" ? "全年度" : `${appliedFilters.year}年`} / ${appliedFilters.subject === "all" ? "全科目" : commonSubjects.find((item) => item.key === appliedFilters.subject)?.label ?? appliedFilters.subject}`;
    return "";
  }, [appliedFilters, rankings]);

  const topEntries = rankings.slice(0, 3);
  const lowerEntries = rankings.slice(3);
  const orderedPodiumEntries = [topEntries[1], topEntries[0], topEntries[2]].filter(Boolean) as RankingEntry[];
  const myEntry = user?.role === "student" ? rankings.find((entry) => entry.studentId === user.id) : undefined;
  const referenceScore = myEntry?.score ?? Math.max(0, (rankings[0]?.score ?? 80) - 22);
  const leaderScore = rankings[0]?.score ?? referenceScore;
  const scoreGap = Math.max(0, roundScore(leaderScore - referenceScore));
  const displayRank = myEntry?.rank ?? Math.max(bestCountNumber + 2, 12);
  const nextGoalScore = Math.ceil(referenceScore + Math.max(5, Math.min(10, scoreGap || 8)));
  const scoreUnit = appliedFilters.stage === "secondary" && appliedFilters.secondaryMode === "progress" ? "回" : "点";

  const handleSearch = async () => {
    setSearchFilters({
      stage: rankingStage,
      secondaryMode,
      periodFrom,
      periodTo,
      year,
      subject,
      secondaryTarget,
      secondaryYear,
      secondarySubject,
    });
    await playEffect("ranking");
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-slate-50 px-6">
        <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
          <LogIn className="mx-auto mb-4 h-10 w-10 text-blue-600" />
          <h1 className="mb-3 text-2xl font-black text-slate-950">ログインが必要です</h1>
          <p className="mb-6 text-sm leading-6 text-slate-600">
            ランキングを見るには、アカウントでログインしてください。
          </p>
          <Link
            href="/login"
            className="inline-flex rounded-lg bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700"
          >
            ログインへ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#260106] text-slate-950">
      <div className="relative overflow-hidden bg-[url('/images/bg-futuristic-red.png')] bg-cover bg-fixed bg-center">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(255,220,160,0.18),transparent_28%),linear-gradient(180deg,rgba(64,0,8,0.18),rgba(32,0,5,0.72))]" />
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <Crown className="absolute -left-10 top-24 h-52 w-52 rotate-[-15deg] text-amber-300/15" strokeWidth={1.1} />
          <Trophy className="absolute -right-8 top-28 h-56 w-56 rotate-[14deg] text-amber-200/14" strokeWidth={1.1} />
          <Medal className="absolute right-[7%] top-[42%] h-36 w-36 text-red-100/10" strokeWidth={1.1} />
          <div className="absolute left-0 top-0 h-full w-36 bg-[linear-gradient(105deg,rgba(255,38,38,0.28),transparent_65%)]" />
          <div className="absolute right-0 top-0 h-full w-36 bg-[linear-gradient(255deg,rgba(255,38,38,0.24),transparent_65%)]" />
        </div>

        <div className="relative mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8">
          <section className="mx-auto mb-4 max-w-[920px] overflow-hidden rounded-[22px] border border-amber-100/40 bg-white/95 shadow-[0_24px_80px_rgba(30,0,5,0.42)]">
            <div className="bg-[linear-gradient(135deg,#fffaf0_0%,#ffffff_46%,#fff1c7_100%)] px-6 py-6 md:px-8 md:py-7">
              <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="mb-2 text-xs font-black tracking-[0.32em] text-red-600">RANKING STAGE</p>
                  <h1 className="text-4xl font-black text-red-950 md:text-5xl">
                    {user.role === "teacher" ? "ランキング管理" : "ランキング"}
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-700">
                    共通テストと大学別2次演習の結果を、校舎や科目ごとのステージランキングで確認できます。
                  </p>
                </div>
                <div className="inline-flex items-center gap-3 rounded-full border border-amber-200 bg-amber-50 px-5 py-3 text-sm font-bold text-amber-900 shadow-sm">
                  <Crown className="h-5 w-5 text-amber-500" />
                  ステージ演出つきベスト{bestCountNumber}
                </div>
              </div>
            </div>
          </section>

          <section className="mx-auto mb-4 max-w-5xl rounded-[18px] border border-white/30 bg-white/96 p-4 shadow-[0_18px_56px_rgba(30,0,5,0.32)] backdrop-blur">
            <div className={`mb-4 inline-grid rounded-2xl border border-red-100 bg-red-50/70 p-1 text-sm font-black text-red-900 ${canUseSecondaryRanking ? "sm:grid-cols-2" : ""}`}>
              <button
                type="button"
                onClick={() => setRankingStage("common")}
                className={`rounded-xl px-4 py-2 transition ${rankingStage === "common" ? "bg-white text-red-950 shadow-sm" : "text-red-700 hover:bg-white/60"}`}
              >
                共通テスト
              </button>
              {canUseSecondaryRanking && (
                <button
                  type="button"
                  onClick={() => setRankingStage("secondary")}
                  className={`rounded-xl px-4 py-2 transition ${rankingStage === "secondary" ? "bg-white text-red-950 shadow-sm" : "text-red-700 hover:bg-white/60"}`}
                >
                  大学別2次
                </button>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Field label="期間開始">
                <input
                  type="date"
                  value={periodFrom}
                  onChange={(event) => setPeriodFrom(event.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-bold text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </Field>

              <Field label="期間終了">
                <input
                  type="date"
                  value={periodTo}
                  onChange={(event) => setPeriodTo(event.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-bold text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </Field>

              {rankingStage === "common" ? (
                <>
                  <SelectField
                    label="年度"
                    value={year}
                    onChange={setYear}
                    options={[
                      { key: "all", label: "すべて" },
                      ...years10.map((item) => ({ key: String(item), label: `${item}年` })),
                    ]}
                  />

                  <SelectField
                    label="科目"
                    value={subject}
                    onChange={setSubject}
                    options={commonSubjects}
                  />
                </>
              ) : (
                <>
                  <SelectField
                    label="ランキング種別"
                    value={secondaryMode}
                    onChange={(value) => setSecondaryMode(value as SecondaryRankingMode)}
                    options={[
                      { key: "score", label: "得点ランキング" },
                      { key: "progress", label: "演習量ランキング" },
                    ]}
                  />

                  <SelectField
                    label="2次コース"
                    value={secondaryTarget}
                    onChange={(value) => setSecondaryTarget(value as SecondaryTargetKey)}
                    options={availableSecondaryTargets.map((target) => ({ key: target.key, label: target.courseLabel }))}
                  />

                  <SelectField
                    label="年度"
                    value={secondaryYear}
                    onChange={setSecondaryYear}
                    options={secondaryYearOptions}
                  />

                  {secondaryMode === "score" && (
                    <SelectField
                      label="科目"
                      value={secondarySubject}
                      onChange={setSecondarySubject}
                      options={secondarySubjectOptions}
                    />
                  )}
                </>
              )}

              <SelectField label="校舎" value={campusFilter} onChange={setCampusFilter} options={campusOptions} />

              <SelectField
                label="表示件数"
                value={bestCount}
                onChange={setBestCount}
                options={[
                  { key: "5", label: "ベスト5" },
                  { key: "10", label: "ベスト10" },
                ]}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex rounded-full border border-red-100 bg-white px-4 py-2 text-xs font-black text-red-700">
                詳細条件
              </div>
              <button
                type="button"
                onClick={() => void handleSearch()}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-[0_12px_28px_rgba(37,99,235,0.24)] transition-colors hover:bg-blue-700"
              >
                <Search className="h-4 w-4" />
                検索してランキングを見る
              </button>
            </div>
          </section>

          {!searchFilters ? (
            <section className="rounded-[24px] border border-white/20 bg-white/90 p-10 text-center shadow-[0_20px_60px_rgba(127,29,29,0.25)]">
              <Medal className="mx-auto mb-4 h-10 w-10 text-red-300" />
              <p className="text-xl font-black text-slate-950">条件を選んでランキングを表示できます</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                期間、年度、科目を決めて検索すると、華やかなランキング表示に切り替わります。
              </p>
            </section>
          ) : (
            <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div className="overflow-hidden rounded-[24px] border border-white/20 bg-red-950/42 shadow-[0_24px_76px_rgba(20,0,5,0.42)] backdrop-blur">
              <div className="border-b border-white/10 bg-white/5 px-5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-black text-white">ベスト{bestCountNumber}</h2>
                    {rankingLabel && (
                      <span className="rounded-full border border-red-200/25 bg-red-800/45 px-3 py-1 text-sm font-bold text-white">
                        {rankingLabel}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 self-end md:self-auto">
                    <span className="rounded-full bg-white/12 px-3 py-1 text-sm font-bold text-white">{rankings.length}件</span>
                  </div>
                </div>
              </div>

              {rankings.length > 0 ? (
                <div className="px-4 py-4 md:px-5">
                  <div className="relative overflow-hidden rounded-[28px] border border-amber-200/30 bg-[radial-gradient(circle_at_50%_0%,rgba(255,230,150,0.28),transparent_38%),linear-gradient(180deg,rgba(96,9,20,0.78),rgba(45,0,8,0.72))] px-4 pb-5 pt-10 shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_18px_46px_rgba(20,0,5,0.28)] md:px-6 md:pb-7 md:pt-14">
                    <div className="pointer-events-none absolute inset-x-10 top-4 h-px bg-[linear-gradient(90deg,transparent,rgba(252,211,77,0.9),transparent)]" />
                    <div className="pointer-events-none absolute left-1/2 top-0 h-28 w-72 -translate-x-1/2 rounded-full bg-amber-200/16 blur-3xl" />
                    <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-24 bg-[linear-gradient(180deg,transparent,rgba(255,201,84,0.12))]" />
                    <div className="relative grid gap-4 md:grid-cols-[0.92fr_1.16fr_0.92fr] md:items-end">
                    {orderedPodiumEntries.map((entry) => (
                      <PodiumCard key={`${entry.studentId}-podium`} entry={entry} />
                    ))}
                    </div>
                  </div>

                  {lowerEntries.length > 0 && (
                    <div className="mt-4 grid gap-2 md:grid-cols-2">
                      {lowerEntries.map((entry) => (
                        <CompactRankingRow key={`${entry.studentId}-${entry.rank}`} entry={entry} />
                      ))}
                    </div>
                  )}

                </div>
              ) : (
                <div className="p-8 text-center">
                  <Medal className="mx-auto mb-4 h-10 w-10 text-red-200" />
                  <p className="font-black text-white">まだランキング対象がありません</p>
                  <p className="mt-2 text-sm leading-6 text-red-100">
                    期間、年度、科目を変えると表示される場合があります。
                  </p>
                </div>
              )}
              </div>

              <aside className="rounded-[24px] border border-white/16 bg-white/10 p-5 text-white shadow-[0_20px_54px_rgba(20,0,5,0.32)] backdrop-blur">
                <h3 className="mb-5 text-lg font-black">あなたの成績</h3>
                <ScoreMetric icon={<Trophy className="h-6 w-6" />} label="全体の順位" value={`${displayRank}位`} tone="gold" />
                <ScoreMetric icon={<ClipboardList className="h-6 w-6" />} label={scoreUnit === "回" ? "自分の演習数" : "自分の点数"} value={`${referenceScore}${scoreUnit}`} tone="white" />
                <ScoreMetric icon={<TrendingUp className="h-6 w-6" />} label="トップとの差" value={`${scoreGap}${scoreUnit}`} tone="white" />
                <ScoreMetric icon={<Target className="h-6 w-6" />} label={scoreUnit === "回" ? "次の目標回数" : "次の目標点"} value={`${nextGoalScore}${scoreUnit}`} tone="gold" />
                <p className="mt-6 border-t border-white/16 pt-4 text-xs font-bold text-red-100">※ 表示は最新のランキング結果をもとにしています</p>
              </aside>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function PodiumCard({ entry }: { entry: RankingEntry }) {
  const isFirst = entry.rank === 1;
  const isSecond = entry.rank === 2;
  const isThird = entry.rank === 3;
  const medalClass =
    entry.rank === 1
      ? "border-amber-300 bg-[linear-gradient(135deg,#fff7c2,#ffffff_45%,#ffc94a)] text-amber-800 shadow-[0_0_34px_rgba(251,191,36,0.54)]"
      : entry.rank === 2
        ? "border-slate-300 bg-[linear-gradient(135deg,#f8fafc,#ffffff_46%,#cbd5e1)] text-slate-600 shadow-[0_0_22px_rgba(226,232,240,0.36)]"
        : "border-orange-300 bg-[linear-gradient(135deg,#fff0df,#ffffff_48%,#fb923c)] text-orange-800 shadow-[0_0_22px_rgba(251,146,60,0.32)]";
  const platformClass = isFirst
    ? "h-16 bg-[linear-gradient(180deg,#fbbf24,#b45309)] border-amber-200"
    : isSecond
      ? "h-10 bg-[linear-gradient(180deg,#e2e8f0,#94a3b8)] border-slate-200"
      : "h-8 bg-[linear-gradient(180deg,#fdba74,#c2410c)] border-orange-200";
  const cardClass = isFirst
    ? "min-h-[260px] border-amber-300 bg-[linear-gradient(145deg,#fffbea_0%,#fff_45%,#ffe4a3_100%)] px-6 pb-6 pt-10 shadow-[0_24px_60px_rgba(245,158,11,0.34)] md:-translate-y-8"
    : isSecond
      ? "min-h-[210px] border-slate-200 bg-[linear-gradient(145deg,#f8fafc_0%,#fff_55%,#dbe4ef_100%)] px-5 pb-5 pt-6 shadow-[0_18px_46px_rgba(148,163,184,0.22)] md:-translate-y-2"
      : "min-h-[198px] border-orange-200 bg-[linear-gradient(145deg,#fff7ed_0%,#fff_55%,#fed7aa_100%)] px-5 pb-5 pt-6 shadow-[0_18px_46px_rgba(194,65,12,0.22)]";

  return (
    <article className="relative flex flex-col">
      <div
        className={`relative overflow-hidden rounded-t-[26px] border text-slate-950 ${cardClass}`}
      >
        <div className="pointer-events-none absolute inset-x-6 top-0 h-1 bg-[linear-gradient(90deg,transparent,rgba(245,158,11,0.95),transparent)]" />
        <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/55 blur-2xl" />
        {isFirst && (
          <>
            <div className="absolute left-1/2 top-2 h-16 w-16 -translate-x-1/2 rounded-full bg-amber-200/35 blur-xl" />
            <Crown className="absolute left-1/2 top-1 h-12 w-12 -translate-x-1/2 text-amber-500 drop-shadow-[0_6px_10px_rgba(180,83,9,0.35)]" />
          </>
        )}
        <div className={`flex items-start justify-between gap-3 ${isFirst ? "mt-7" : ""}`}>
          <div className={`flex shrink-0 items-center justify-center rounded-full border-2 font-black ${medalClass} ${isFirst ? "h-20 w-20 text-4xl" : "h-14 w-14 text-2xl"}`}>
            {entry.rank}
          </div>
          <div className="text-right">
            <span className={`font-black text-red-800 ${isFirst ? "text-5xl" : "text-4xl"}`}>{entry.score}</span>
            <span className="ml-1 text-sm font-black text-red-700">{entry.unitLabel ?? "点"}</span>
          </div>
        </div>
        <p className={`mt-5 truncate font-black text-slate-950 ${isFirst ? "text-2xl" : "text-lg"}`}>{entry.name}</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-slate-600">
          <span>{entry.campus}</span>
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            {new Date(entry.executedAt).toLocaleDateString("ja-JP")}
          </span>
        </div>
        {entry.subLabel && <p className="mt-2 truncate text-xs font-black text-red-700">{entry.subLabel}</p>}
      </div>
      <div className={`relative rounded-b-[22px] border-x border-b px-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] ${platformClass}`}>
        <div className="absolute inset-x-4 top-2 h-px bg-white/45" />
        <span className={`absolute inset-x-0 bottom-2 font-black tracking-[0.16em] text-white/70 ${isFirst ? "text-sm" : "text-xs"}`}>
          {isFirst ? "CHAMPION" : isSecond ? "SILVER" : isThird ? "BRONZE" : "RANK"}
        </span>
      </div>
    </article>
  );
}

function CompactRankingRow({ entry }: { entry: RankingEntry }) {
  return (
    <div className="grid grid-cols-[42px_minmax(0,1.15fr)_minmax(70px,0.6fr)_84px] items-center gap-3 rounded-lg border border-red-100/70 bg-white/96 px-4 py-2 text-sm shadow-[0_8px_22px_rgba(40,0,6,0.16)]">
      <span className="text-center text-base font-black text-red-700">{entry.rank}</span>
      <span className="min-w-0">
        <span className="block truncate font-black text-slate-950">{entry.name}</span>
        {entry.subLabel && <span className="block truncate text-[11px] font-bold text-slate-500">{entry.subLabel}</span>}
      </span>
      <span className="truncate text-xs font-bold text-slate-600">{entry.campus}</span>
      <span className="text-right text-lg font-black text-red-800">{entry.score}{entry.unitLabel ?? "点"}</span>
    </div>
  );
}

function ScoreMetric({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "gold" | "white";
}) {
  return (
    <div className="flex items-center gap-4 border-b border-white/12 py-4 last:border-b-0">
      <div className={tone === "gold" ? "text-amber-300" : "text-white/90"}>{icon}</div>
      <div>
        <p className="text-xs font-black text-red-100">{label}</p>
        <p className="mt-1 text-2xl font-black text-white">{value}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-bold text-slate-700">{label}</span>
      {children}
    </label>
  );
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
  options: { key: string; label: string }[];
}) {
  return (
    <Field label={label}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-bold text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
      >
        {options.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
