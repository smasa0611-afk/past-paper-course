"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpDown,
  CheckSquare,
  ClipboardList,
  Filter,
  LogIn,
  Search,
  X,
} from "lucide-react";
import type { StudentGoal } from "@/types/admissions";
import type { ExamMetadata } from "@/types/exam";
import {
  isTeacher1092DemoUser,
  mergeByKey,
  teacher1092DemoAssignments,
  teacher1092DemoCourses,
  teacher1092DemoEnrollments,
  teacher1092DemoStudents,
  teacher1092DemoSubmissions,
} from "@/lib/teacher-1092-demo";

type User = { id: string; name: string; role: "student" | "teacher" };
type Student = { id: string; displayName: string; nickname?: string; group?: string; campus?: string; grade?: string; target?: string };
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
type Submission = { id: string; examId: string; studentId: string; timestamp: string; status: string; score?: number; maxScore?: number; gradedAt?: string; importedAt?: string };
type Course = { code: string; name: string; category: string };
type Enrollment = {
  studentId: string;
  nickname?: string;
  group?: string;
  campus?: string;
  grade?: string;
  goalUniversity?: string;
  goalFaculty?: string;
  goalDepartment?: string;
  courseCode: string;
  courseName: string;
  courseCategory: string;
  year?: string;
  note?: string;
};
type ImportedScore = {
  studentId: string;
  courseTitle: string;
  assignmentName: string;
  subject: string;
  year: string;
  round: string;
  score?: number;
  dueDate?: string;
  submittedAt?: string;
  gradedAt?: string;
  note?: string;
  importedAt: string;
};
type Row = {
  student: Student;
  nickname: string;
  group: string;
  campus: string;
  grade: string;
  goalUniversity: string;
  goalFaculty: string;
  goalDepartment: string;
  courseCode: string;
  courseName: string;
  courseCategory: string;
  latestAssignmentName: string;
  subject: string;
  year: string;
  dueDate: string;
  examStatus: "受験済" | "未受験";
  submissionStatus: "未提出" | "提出済" | "採点待ち" | "点数未入力";
  score: number | null;
  benchmarkDiff: number | null;
  scoreRate: number | null;
  subjectMaxScore: number | null;
  lastSubmittedAt: string;
  importedAt: string;
  commonProgress: string;
  secondaryProgress: string;
  missingCount: number;
  averageScore: number | null;
  belowBenchmarkCount: number;
  assignment?: Assignment;
  submission?: Submission;
  importedScore?: ImportedScore;
  goal?: StudentGoal;
  note: string;
};
type SortKey = keyof Pick<Row,
  "student" | "nickname" | "group" | "campus" | "grade" | "goalUniversity" | "goalFaculty" | "goalDepartment" |
  "courseCode" | "courseCategory" | "latestAssignmentName" | "subject" | "dueDate" | "examStatus" | "submissionStatus" |
  "score" | "benchmarkDiff" | "scoreRate" | "subjectMaxScore" | "lastSubmittedAt" | "importedAt" | "commonProgress" | "secondaryProgress" |
  "missingCount" | "averageScore" | "belowBenchmarkCount" | "note"
>;
type SortState = { key: SortKey; direction: "asc" | "desc" };
type DetailTab = "basic" | "goal" | "course" | "assignments" | "progress" | "submissions" | "scores";
type QuickFilter = "missing" | "thisWeek" | "goalMissing" | "belowBenchmark" | "scoreMissing" | "notTaken";
type ViewMode = "common" | "secondary";
type CommonDeadlineTargetMode = "campus" | "goal";
type Column = {
  key: SortKey | "select" | "courseLabel" | "action";
  label: string;
  className?: string;
  render?: (row: Row) => React.ReactNode;
};

const subjectLabels: Record<string, string> = {
  english: "英語",
  english_listening: "英語リスニング",
  japanese: "国語",
  math_ia: "数学IA",
  math_iibc: "数学IIBC",
  math_iib: "数学IIB",
  information_i: "情報I",
  world_history: "世界史探究",
  japanese_history: "日本史探究",
  geography: "地理総合・地理探究",
  integrated_history_public: "地理総合・歴史総合・公共",
  public_ethics: "公共・倫理",
  public_politics_economy: "公共・政治経済",
  physics: "物理",
  chemistry: "化学",
  biology: "生物",
  earth_science: "地学",
  science_basics: "理科基礎",
};
const tabs: [DetailTab, string][] = [
  ["basic", "基本情報"],
  ["goal", "志望校"],
  ["course", "受講コース"],
  ["assignments", "課題"],
  ["progress", "テスト進捗"],
  ["submissions", "提出履歴"],
  ["scores", "点数履歴"],
];
const quickFilters: [QuickFilter, string][] = [
  ["missing", "未提出ありのみ"],
  ["thisWeek", "今週締切のみ"],
  ["goalMissing", "志望校未登録のみ"],
  ["belowBenchmark", "基準点未達のみ"],
  ["scoreMissing", "点数未入力のみ"],
  ["notTaken", "未受験のみ"],
];
const ALL_GROUP_OPTION = "さなるグループ全部";
const viewModes: [ViewMode, string][] = [
  ["common", "共通テスト演習管理"],
  ["secondary", "大学別2次演習管理"],
];

const todayKey = () => new Date().toISOString().slice(0, 10);
const safeText = (value?: string | number | null) => (value === undefined || value === null || value === "" ? "-" : String(value));
const courseLabel = (code: string, name: string) => (code && name ? `${code} ${name}` : "-");
const localDate = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ja-JP");
};
const dueDateState = (dateText: string) => {
  if (!dateText) {
    return { label: "締切未設定", detail: "", className: "border-slate-300 bg-slate-100 text-slate-700" };
  }
  if (dateText < todayKey()) {
    return { label: "締切超過", detail: localDate(dateText), className: "border-red-200 bg-red-50 text-red-700" };
  }
  if (dateText === todayKey()) {
    return { label: "本日締切", detail: localDate(dateText), className: "border-amber-200 bg-amber-50 text-amber-700" };
  }
  return { label: "締切設定済", detail: localDate(dateText), className: "border-blue-200 bg-blue-50 text-blue-700" };
};
const renderDueDate = (row: Row) => {
  const state = dueDateState(row.dueDate);
  return (
    <span className={`inline-flex min-w-24 flex-col rounded border px-2 py-1 text-xs font-bold leading-tight ${state.className}`}>
      <span>{state.label}</span>
      {state.detail && <span className="mt-0.5 font-mono text-[11px] font-semibold opacity-80">{state.detail}</span>}
    </span>
  );
};
const examTitle = (exam: ExamMetadata | undefined, examId: string) => {
  if (exam?.title && !exam.title.includes("�")) return exam.title;
  const parts = examId.replace(/\\/g, "/").split("/");
  const year = parts[1];
  const subject = parts[2];
  if (parts[0] === "common" && year && subject) return `共通テスト ${subjectLabels[subject] ?? subject} ${year}`;
  if (parts[0] === "todai") return `東大2次 ${subjectLabels[parts[2]] ?? parts[2] ?? ""} ${year ?? ""}`.trim();
  if (parts[0] === "kyodai") return `京大2次 ${subjectLabels[parts[2]] ?? parts[2] ?? ""} ${year ?? ""}`.trim();
  if (parts[0] === "nagoya") return `名大2次 ${subjectLabels[parts[2]] ?? parts[2] ?? ""} ${year ?? ""}`.trim();
  return exam?.title || examId;
};
const inThisWeek = (dateText: string) => {
  if (!dateText) return false;
  const date = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date(`${todayKey()}T00:00:00`);
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return date >= monday && date <= sunday;
};
const parseTarget = (target?: string) => {
  const parts = (target || "").split(/\s+/).filter(Boolean);
  return { university: parts[0] || "", faculty: parts[1] || "", department: parts.slice(2).join(" ") };
};
const csvEscape = (value: string | number | null | undefined) => `"${String(value ?? "").replace(/"/g, "\"\"")}"`;
const subjectFromExamId = (examId?: string) => {
  if (!examId) return "";
  const parts = examId.replace(/\\/g, "/").split("/");
  if (parts[0] === "common" || parts[0] === "common_retake") return subjectLabels[parts[2]] ?? parts[2] ?? "";
  return subjectLabels[parts[2]] ?? parts[2] ?? "";
};
const SECONDARY_BENCHMARK_RATE = 60;
const SECONDARY_SUBJECT_MAX: Record<string, Record<string, number>> = {
  todai: { english: 120, math: 120, japanese: 80, physics: 60, chemistry: 60 },
  kyodai: { english: 150, math: 200, japanese: 150, science: 200, physics: 200, chemistry: 200, biology: 200 },
  nagoya: { english: 300, math: 500, physics: 250, chemistry: 250 },
  hamamatsu_medical: { english: 200, math: 200, science: 300, physics: 300, chemistry: 300, biology: 300 },
};
const secondarySubjectMaxFromExamId = (examId?: string) => {
  if (!examId || examId.startsWith("common/")) return null;
  const [target, , subject] = examId.replace(/\\/g, "/").split("/");
  return SECONDARY_SUBJECT_MAX[target]?.[subject] ?? null;
};
const rateFromScore = (score: number | null | undefined, maxScore?: number | null) => {
  if (typeof score !== "number") return null;
  const base = typeof maxScore === "number" && maxScore > 0 ? maxScore : 100;
  return Number(((score / base) * 100).toFixed(1));
};
const secondaryRateFromRawScore = (score: number | null | undefined, subjectMaxScore: number | null) => (
  typeof score === "number" && typeof subjectMaxScore === "number" && subjectMaxScore > 0
    ? Number(((score / subjectMaxScore) * 100).toFixed(1))
    : null
);
const formatRate = (rate: number | null) => {
  if (rate === null) return "-";
  return Number.isInteger(rate) ? `${rate}%` : `${rate.toFixed(1)}%`;
};
const isBelowBenchmark = (row: Row, viewMode: ViewMode) => viewMode === "secondary"
  ? row.scoreRate !== null && row.scoreRate < SECONDARY_BENCHMARK_RATE
  : row.benchmarkDiff !== null && row.benchmarkDiff < 0;
const normalizeExamId = (examId: string) => examId.replace(/^\/+/, "").replace(/\\/g, "/");
const isCommonExamId = (examId?: string) => {
  const normalized = normalizeExamId(examId ?? "");
  return normalized.startsWith("common/") || normalized.startsWith("common_retake/");
};
const isCommonExam = (exam: ExamMetadata) => exam.exam_type === "common" || exam.exam_type === "common_retake" || isCommonExamId(exam.id);
const commonSubjectLabel = (subject: string) => subjectLabels[subject] ?? subject;
const isCommonAssignment = (assignment?: Assignment, imported?: ImportedScore, rowCourseCategory?: string) => {
  if (imported?.courseTitle.includes("共通")) return true;
  if (assignment) return isCommonExamId(assignment.examId);
  return Boolean(rowCourseCategory?.includes("共通"));
};
const isSecondaryAssignment = (assignment?: Assignment, imported?: ImportedScore, rowCourseCategory?: string) => {
  if (imported?.courseTitle.includes("2次")) return true;
  if (assignment) return !isCommonExamId(assignment.examId);
  return Boolean(rowCourseCategory?.includes("大学別") || rowCourseCategory?.includes("2次"));
};
const subjectMatches = (filter: string, subject: string) => (
  !filter || subject === filter || (filter === "英語" && subject.startsWith("英語"))
);
const normalizeFilterText = (value: string) => value.replace(/\s+/g, "");
const assignmentMatches = (filter: string, assignmentName: string) => (
  !filter || assignmentName === filter || normalizeFilterText(assignmentName) === normalizeFilterText(filter)
);
const isTeacher1092ProgressRow = (row: Row) => (
  row.student.id.startsWith("1092") || row.campus.includes("北高前校3号館")
);
const campusFilterMatchesTeacher1092 = (campuses: string[]) => (
  campuses.some((campus) => campus.includes("北高前校3号館"))
);

const rowKey = (row: Row, index: number) => [
  row.student.id,
  row.assignment?.id,
  row.submission?.id,
  row.importedScore ? `${row.importedScore.courseTitle}-${row.importedScore.assignmentName}-${row.importedScore.subject}-${row.importedScore.year}-${row.importedScore.importedAt}` : "",
  row.latestAssignmentName,
  row.subject,
  row.year,
  index,
].filter(Boolean).join("|");

const hasExerciseSource = (row: Row) => Boolean(row.assignment || row.importedScore || row.courseCategory);
const matchesViewMode = (viewMode: ViewMode, row: Row) => {
  if (!hasExerciseSource(row)) return true;
  return viewMode === "common"
    ? isCommonAssignment(row.assignment, row.importedScore, row.courseCategory)
    : isSecondaryAssignment(row.assignment, row.importedScore, row.courseCategory);
};

function statusBadgeClass(status: string) {
  if (status === "未提出" || status === "基準点未達") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "提出済" || status === "基準点達成") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "採点待ち" || status === "点数未入力") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "受験済") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "志望校未登録") return "border-violet-200 bg-violet-50 text-violet-700";
  return "border-slate-200 bg-slate-100 text-slate-600";
}

function Badge({ children }: { children: string }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(children)}`}>{children}</span>;
}

function MultiSelect({
  label,
  values,
  selected,
  onChange,
  placeholder = "指定なし",
}: {
  label: string;
  values: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  return (
    <label className="space-y-1 text-xs font-semibold text-slate-600">
      <span>{label}</span>
      <select
        multiple
        value={selected}
        onChange={(event) => onChange(Array.from(event.currentTarget.selectedOptions).map((option) => option.value))}
        className="h-24 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
      >
        {values.length === 0 ? <option disabled>{placeholder}</option> : values.map((value) => <option key={value} value={value}>{value}</option>)}
      </select>
    </label>
  );
}

export default function GradingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [exams, setExams] = useState<ExamMetadata[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [goals, setGoals] = useState<StudentGoal[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [importedScores, setImportedScores] = useState<ImportedScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [groupFilter, setGroupFilter] = useState<string[]>([ALL_GROUP_OPTION]);
  const [campusFilter, setCampusFilter] = useState<string[]>([]);
  const [gradeFilter, setGradeFilter] = useState("高3");
  const [goalUniversityFilter, setGoalUniversityFilter] = useState("");
  const [goalFacultyFilter, setGoalFacultyFilter] = useState("");
  const [goalDepartmentFilter, setGoalDepartmentFilter] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [courseCategoryFilter, setCourseCategoryFilter] = useState("");
  const [assignmentFilter, setAssignmentFilter] = useState("共通テスト英語2026");
  const [yearFilter, setYearFilter] = useState("2026");
  const [dueWeekFilter, setDueWeekFilter] = useState("");
  const [submissionFilter, setSubmissionFilter] = useState("");
  const [examFilter, setExamFilter] = useState("");
  const [scoreMin, setScoreMin] = useState("");
  const [scoreMax, setScoreMax] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("英語");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [activeQuickFilters, setActiveQuickFilters] = useState<QuickFilter[]>([]);
  const [sort, setSort] = useState<SortState>({ key: "student", direction: "asc" });
  const [viewMode, setViewMode] = useState<ViewMode>("common");
  const [detailFiltersOpen, setDetailFiltersOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailRow, setDetailRow] = useState<Row | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("basic");
  const [bulkExamId, setBulkExamId] = useState("");
  const [bulkDueDate, setBulkDueDate] = useState(todayKey());
  const [bulkMessage, setBulkMessage] = useState("");
  const [commonDeadlineMode, setCommonDeadlineMode] = useState<CommonDeadlineTargetMode>("campus");
  const [commonDeadlineCampuses, setCommonDeadlineCampuses] = useState<string[]>([]);
  const [commonDeadlineGoalUniversity, setCommonDeadlineGoalUniversity] = useState("");
  const [commonDeadlineGoalFaculty, setCommonDeadlineGoalFaculty] = useState("");
  const [commonDeadlineYear, setCommonDeadlineYear] = useState("2026");
  const [commonDeadlineSubject, setCommonDeadlineSubject] = useState("");
  const [commonDeadlineDueDate, setCommonDeadlineDueDate] = useState(todayKey());
  const [commonDeadlineMessage, setCommonDeadlineMessage] = useState("");

  const load = async () => {
    setError("");
    const [me, st, ex, as, sub, go, cm] = await Promise.all([
      fetch("/api/auth/me").then((r) => (r.ok ? r.json() : { user: null })),
      fetch("/api/students").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/exams").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/assignments").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/submissions").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/student-goals").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/course-management").then((r) => (r.ok ? r.json() : { courses: [], enrollments: [], scores: [] })),
    ]);
    setUser(me.user);
    const isTeacher1092Demo = isTeacher1092DemoUser(me.user?.id);
    setStudents(isTeacher1092Demo
      ? mergeByKey(Array.isArray(st) ? st : [], teacher1092DemoStudents, (student) => student.id)
      : Array.isArray(st) ? st : []);
    setExams(Array.isArray(ex) ? ex : []);
    setAssignments(isTeacher1092Demo
      ? mergeByKey(Array.isArray(as) ? as : [], teacher1092DemoAssignments, (assignment) => assignment.id)
      : Array.isArray(as) ? as : []);
    setSubmissions(isTeacher1092Demo
      ? mergeByKey(Array.isArray(sub) ? sub : [], teacher1092DemoSubmissions, (submission) => submission.id)
      : Array.isArray(sub) ? sub : []);
    setGoals(Array.isArray(go) ? go : []);
    setCourses(isTeacher1092Demo
      ? mergeByKey(Array.isArray(cm.courses) ? cm.courses : [], teacher1092DemoCourses, (course) => course.code)
      : Array.isArray(cm.courses) ? cm.courses : []);
    setEnrollments(isTeacher1092Demo
      ? mergeByKey(Array.isArray(cm.enrollments) ? cm.enrollments : [], teacher1092DemoEnrollments, (enrollment) => `${enrollment.studentId}-${enrollment.courseCode}-${enrollment.year ?? ""}`)
      : Array.isArray(cm.enrollments) ? cm.enrollments : []);
    setImportedScores(Array.isArray(cm.scores) ? cm.scores : []);
  };

  useEffect(() => {
    load().catch((err) => {
      console.error(err);
      setError("教師管理データの読み込みに失敗しました。");
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!bulkExamId && exams[0]) setBulkExamId(exams[0].id);
  }, [bulkExamId, exams]);

  useEffect(() => {
    const commonExam = exams.find(isCommonExam);
    if (!commonDeadlineSubject && commonExam) setCommonDeadlineSubject(commonExam.subject);
    if (!commonDeadlineYear && commonExam) setCommonDeadlineYear(String(commonExam.year));
  }, [commonDeadlineSubject, commonDeadlineYear, exams]);

  useEffect(() => {
    if (viewMode === "common") {
      setYearFilter((value) => value || "2026");
      setSubjectFilter((value) => value || "英語");
      setAssignmentFilter((value) => value || "共通テスト英語2026");
      setGradeFilter((value) => value || "高3");
    }
  }, [viewMode]);

  useEffect(() => {
    if (viewMode !== "secondary") return;
    setYearFilter((value) => value || "2026");
    setSubjectFilter("");
    setAssignmentFilter("");
  }, [viewMode]);

  const examsById = useMemo(() => new Map(exams.map((exam) => [exam.id, exam])), [exams]);
  const goalsByStudent = useMemo(() => {
    const map = new Map<string, StudentGoal[]>();
    goals.forEach((goal) => map.set(goal.studentId, [...(map.get(goal.studentId) || []), goal]));
    return map;
  }, [goals]);
  const enrollmentsByStudent = useMemo(() => {
    const map = new Map<string, Enrollment[]>();
    enrollments.forEach((enrollment) => map.set(enrollment.studentId, [...(map.get(enrollment.studentId) || []), enrollment]));
    return map;
  }, [enrollments]);
  const scoresByStudent = useMemo(() => {
    const map = new Map<string, ImportedScore[]>();
    importedScores.forEach((score) => map.set(score.studentId, [...(map.get(score.studentId) || []), score]));
    return map;
  }, [importedScores]);
  const assignmentsByStudent = useMemo(() => {
    const map = new Map<string, Assignment[]>();
    assignments.forEach((assignment) => map.set(assignment.studentId, [...(map.get(assignment.studentId) || []), assignment]));
    return map;
  }, [assignments]);
  const submissionsByStudent = useMemo(() => {
    const map = new Map<string, Submission[]>();
    submissions.forEach((submission) => map.set(submission.studentId, [...(map.get(submission.studentId) || []), submission]));
    return map;
  }, [submissions]);

  const commonExams = useMemo(() => exams.filter(isCommonExam), [exams]);
  const commonDeadlineYearOptions = useMemo(
    () => Array.from(new Set(commonExams.map((exam) => String(exam.year)))).sort((a, b) => Number(b) - Number(a)),
    [commonExams],
  );
  const commonDeadlineSubjectOptions = useMemo(() => {
    const inYear = commonExams.filter((exam) => !commonDeadlineYear || String(exam.year) === commonDeadlineYear);
    return Array.from(new Set(inYear.map((exam) => exam.subject)))
      .sort((a, b) => commonSubjectLabel(a).localeCompare(commonSubjectLabel(b), "ja"));
  }, [commonDeadlineYear, commonExams]);
  const commonDeadlineExam = useMemo(
    () => commonExams.find((exam) => String(exam.year) === commonDeadlineYear && exam.subject === commonDeadlineSubject) ?? null,
    [commonDeadlineSubject, commonDeadlineYear, commonExams],
  );

  useEffect(() => {
    if (commonDeadlineSubjectOptions.length && !commonDeadlineSubjectOptions.includes(commonDeadlineSubject)) {
      setCommonDeadlineSubject(commonDeadlineSubjectOptions[0]);
    }
  }, [commonDeadlineSubject, commonDeadlineSubjectOptions]);

  const rows = useMemo<Row[]>(() => {
    const studentMap = new Map(students.map((student) => [student.id, student]));
    enrollments.forEach((enrollment) => {
      if (!studentMap.has(enrollment.studentId)) {
        studentMap.set(enrollment.studentId, {
          id: enrollment.studentId,
          displayName: enrollment.nickname || "未設定",
          nickname: enrollment.nickname || "未設定",
          campus: enrollment.campus,
          grade: enrollment.grade,
          target: [enrollment.goalUniversity, enrollment.goalFaculty, enrollment.goalDepartment].filter(Boolean).join(" "),
        });
      }
    });
    submissions.forEach((submission) => {
      if (!studentMap.has(submission.studentId)) {
        studentMap.set(submission.studentId, {
          id: submission.studentId,
          displayName: submission.studentId,
          nickname: submission.studentId,
        });
      }
    });
    importedScores.forEach((score) => {
      if (!studentMap.has(score.studentId)) {
        studentMap.set(score.studentId, {
          id: score.studentId,
          displayName: score.studentId,
          nickname: score.studentId,
        });
      }
    });
    return Array.from(studentMap.values()).map((student) => {
      const studentEnrollments = enrollmentsByStudent.get(student.id) || [];
      const primaryEnrollment = studentEnrollments[0];
      const studentGoals = goalsByStudent.get(student.id) || [];
      const primaryGoal = studentGoals[0];
      const target = parseTarget(student.target);
      const studentAssignments = (assignmentsByStudent.get(student.id) || []).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      const studentSubmissions = (submissionsByStudent.get(student.id) || []).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      const studentScores = (scoresByStudent.get(student.id) || []).sort((a, b) => (b.submittedAt || b.gradedAt || b.importedAt).localeCompare(a.submittedAt || a.gradedAt || a.importedAt));
      const latestAssignment = studentAssignments.find((assignment) => !studentSubmissions.some((submission) => submission.examId === assignment.examId)) || studentAssignments[0];
      const latestSubmission = studentSubmissions[0];
      const latestImportedScore = studentScores[0];
      const scoreFromSubmission = latestSubmission?.score;
      const maxScore = latestSubmission?.maxScore || 100;
      const score = typeof scoreFromSubmission === "number"
        ? Math.round((scoreFromSubmission / maxScore) * 100)
        : typeof latestImportedScore?.score === "number"
          ? latestImportedScore.score
          : null;
      const submittedAt = latestSubmission?.timestamp || latestImportedScore?.submittedAt || "";
      const hasSubmission = Boolean(latestSubmission || latestImportedScore?.submittedAt);
      const submissionStatus: Row["submissionStatus"] = !hasSubmission
        ? "未提出"
        : score === null
          ? "点数未入力"
          : latestSubmission && latestSubmission.status !== "graded"
            ? "採点待ち"
            : "提出済";
      const benchmark = typeof primaryGoal?.bRate === "number" ? primaryGoal.bRate : null;
      const submittedExamIds = new Set(studentSubmissions.map((submission) => submission.examId));
      const scoreValues = [
        ...studentSubmissions
          .filter((submission) => typeof submission.score === "number")
          .map((submission) => Math.round(((submission.score ?? 0) / (submission.maxScore || 100)) * 100)),
        ...studentScores
          .filter((item) => typeof item.score === "number")
          .map((item) => item.score as number),
      ];
      const commonAssignments = studentAssignments.filter((assignment) => isCommonExamId(assignment.examId));
      const secondaryAssignments = studentAssignments.filter((assignment) => !isCommonExamId(assignment.examId));
      const commonSubmitted = commonAssignments.filter((assignment) => submittedExamIds.has(assignment.examId)).length
        + studentScores.filter((item) => item.submittedAt && item.courseTitle.includes("共通")).length;
      const secondarySubmitted = secondaryAssignments.filter((assignment) => submittedExamIds.has(assignment.examId)).length
        + studentScores.filter((item) => item.submittedAt && item.courseTitle.includes("2次")).length;
      const commonTotal = commonAssignments.length + studentScores.filter((item) => item.courseTitle.includes("共通")).length;
      const secondaryTotal = secondaryAssignments.length + studentScores.filter((item) => item.courseTitle.includes("2次")).length;
      const assignmentMissingCount = studentAssignments.filter((assignment) => !submittedExamIds.has(assignment.examId)).length;
      const scoreMissingCount = studentScores.filter((item) => !item.submittedAt).length;

      return {
        student,
        nickname: student.nickname || primaryEnrollment?.nickname || "未設定",
        group: primaryEnrollment?.group || student.group || "未設定",
        campus: primaryEnrollment?.campus || student.campus || "未設定",
        grade: primaryEnrollment?.grade || student.grade || "未設定",
        goalUniversity: primaryEnrollment?.goalUniversity || primaryGoal?.university || target.university,
        goalFaculty: primaryEnrollment?.goalFaculty || primaryGoal?.faculty || target.faculty,
        goalDepartment: primaryEnrollment?.goalDepartment || primaryGoal?.department || target.department,
        courseCode: primaryEnrollment?.courseCode || "",
        courseName: primaryEnrollment?.courseName || "",
        courseCategory: primaryEnrollment?.courseCategory || "",
        latestAssignmentName: latestImportedScore?.assignmentName || (latestAssignment ? examTitle(examsById.get(latestAssignment.examId), latestAssignment.examId) : ""),
        subject: latestImportedScore?.subject || subjectFromExamId(latestAssignment?.examId),
        year: latestImportedScore?.year || primaryEnrollment?.year || "",
        dueDate: latestAssignment?.dueDate || "",
        examStatus: hasSubmission ? "受験済" : "未受験",
        submissionStatus,
        score,
        benchmarkDiff: score !== null && benchmark !== null ? Number((score - benchmark).toFixed(1)) : null,
        scoreRate: score,
        subjectMaxScore: null,
        lastSubmittedAt: submittedAt,
        importedAt: latestSubmission?.importedAt || latestImportedScore?.importedAt || "",
        commonProgress: `${commonSubmitted}/${commonTotal}提出`,
        secondaryProgress: `${secondarySubmitted}/${secondaryTotal}提出`,
        missingCount: assignmentMissingCount + scoreMissingCount,
        averageScore: scoreValues.length ? Number((scoreValues.reduce((sum, value) => sum + value, 0) / scoreValues.length).toFixed(1)) : null,
        belowBenchmarkCount: benchmark === null ? 0 : scoreValues.filter((value) => value < benchmark).length,
        assignment: latestAssignment,
        submission: latestSubmission,
        importedScore: latestImportedScore,
        goal: primaryGoal,
        note: primaryEnrollment?.note || "",
      };
    });
  }, [assignmentsByStudent, enrollments, enrollmentsByStudent, examsById, goalsByStudent, importedScores, scoresByStudent, students, submissions, submissionsByStudent]);

  const options = useMemo(() => {
    const values = (picker: (row: Row) => string) => Array.from(new Set(rows.map(picker).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ja"));
    const assignmentsForMode = assignments.filter((assignment) => viewMode === "common" ? isCommonExamId(assignment.examId) : !isCommonExamId(assignment.examId));
    const submissionsForMode = submissions.filter((submission) => viewMode === "common" ? isCommonExamId(submission.examId) : !isCommonExamId(submission.examId));
    const scoreText = viewMode === "common" ? "共通" : "2次";
    const scoresForMode = importedScores.filter((item) => item.courseTitle.includes(scoreText));
    const taskAssignments = [
      ...assignmentsForMode.map((assignment) => examTitle(examsById.get(assignment.examId), assignment.examId)),
      ...submissionsForMode.map((submission) => examTitle(examsById.get(submission.examId), submission.examId)),
      ...scoresForMode.map((item) => item.assignmentName),
    ];
    const taskSubjects = [
      ...assignmentsForMode.map((assignment) => subjectFromExamId(assignment.examId)),
      ...submissionsForMode.map((submission) => subjectFromExamId(submission.examId)),
      ...scoresForMode.map((item) => item.subject),
    ];
    const taskYears = [
      ...assignmentsForMode.map((assignment) => assignment.examId.split("/")[1] || ""),
      ...submissionsForMode.map((submission) => submission.examId.split("/")[1] || ""),
      ...scoresForMode.map((item) => item.year),
    ];
    const rowGroups = values((row) => row.group).filter((group) => group !== ALL_GROUP_OPTION && group !== "未設定");
    const hasUnsetGroup = rows.some((row) => row.group === "未設定");
    const groups = [ALL_GROUP_OPTION, ...rowGroups, ...(hasUnsetGroup ? ["未設定"] : [])];
    const selectedGroups = groupFilter.includes(ALL_GROUP_OPTION) || groupFilter.length === 0 ? [] : groupFilter;
    const campuses = selectedGroups.length
      ? Array.from(new Set(rows.filter((row) => selectedGroups.includes(row.group)).map((row) => row.campus).filter(Boolean)))
      : values((row) => row.campus);
    return {
      groups,
      campuses: campuses.length ? campuses : values((row) => row.campus),
      grades: values((row) => row.grade),
      universities: values((row) => row.goalUniversity),
      faculties: values((row) => row.goalFaculty),
      departments: values((row) => row.goalDepartment),
      courseCategories: values((row) => row.courseCategory),
      assignments: Array.from(new Set(taskAssignments.filter(Boolean))).sort((a, b) => a.localeCompare(b, "ja")),
      subjects: Array.from(new Set(taskSubjects.filter(Boolean))).sort((a, b) => a.localeCompare(b, "ja")),
      years: Array.from(new Set(taskYears.filter(Boolean))).sort((a, b) => a.localeCompare(b, "ja")),
    };
  }, [assignments, examsById, groupFilter, importedScores, rows, submissions, viewMode]);

  const filteredRows = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    const min = scoreMin === "" ? null : Number(scoreMin);
    const max = scoreMax === "" ? null : Number(scoreMax);
    const active = new Set(activeQuickFilters);
    const filtered = rows.filter((row) => {
      const taskFiltersApplyHere = false;
      const isTeacher1092Row = isTeacher1092ProgressRow(row);
      const allowTeacher1092ByCampus = isTeacher1092Row && campusFilterMatchesTeacher1092(campusFilter);
      if (!allowTeacher1092ByCampus && groupFilter.length && !groupFilter.includes(ALL_GROUP_OPTION) && !groupFilter.includes(row.group)) return false;
      if (!allowTeacher1092ByCampus && campusFilter.length && !campusFilter.includes(row.campus)) return false;
      if (!allowTeacher1092ByCampus && gradeFilter && row.grade !== gradeFilter) return false;
      if (allowTeacher1092ByCampus && gradeFilter && gradeFilter !== "高3" && row.grade !== gradeFilter) return false;
      if (goalUniversityFilter && row.goalUniversity !== goalUniversityFilter) return false;
      if (goalFacultyFilter && row.goalFaculty !== goalFacultyFilter) return false;
      if (goalDepartmentFilter && row.goalDepartment !== goalDepartmentFilter) return false;
      if (courseFilter && row.courseCode !== courseFilter) return false;
      if (courseCategoryFilter && row.courseCategory !== courseCategoryFilter) return false;
      if (taskFiltersApplyHere && yearFilter && row.year && row.year !== yearFilter) return false;
      if (taskFiltersApplyHere && assignmentFilter && row.latestAssignmentName !== assignmentFilter) return false;
      if (taskFiltersApplyHere && subjectFilter && row.subject !== subjectFilter) return false;
      if (taskFiltersApplyHere && dueWeekFilter === "this" && !inThisWeek(row.dueDate)) return false;
      if (taskFiltersApplyHere && dueWeekFilter === "none" && row.dueDate) return false;
      if (taskFiltersApplyHere && submissionFilter && row.submissionStatus !== submissionFilter) return false;
      if (taskFiltersApplyHere && examFilter && row.examStatus !== examFilter) return false;
      if (taskFiltersApplyHere && min !== null && (row.score === null || row.score < min)) return false;
      if (taskFiltersApplyHere && max !== null && (row.score === null || row.score > max)) return false;
      if (keyword && !`${row.student.id} ${row.nickname}`.toLowerCase().includes(keyword)) return false;
      if (taskFiltersApplyHere && active.has("missing") && row.submissionStatus !== "未提出") return false;
      if (taskFiltersApplyHere && active.has("thisWeek") && !inThisWeek(row.dueDate)) return false;
      if (active.has("goalMissing") && row.goalUniversity) return false;
      if (taskFiltersApplyHere && viewMode === "common" && active.has("belowBenchmark") && !isBelowBenchmark(row, viewMode)) return false;
      if (taskFiltersApplyHere && active.has("scoreMissing") && row.score !== null) return false;
      if (taskFiltersApplyHere && active.has("notTaken") && row.examStatus !== "未受験") return false;
      return true;
    });

    return filtered.sort((a, b) => {
      const direction = sort.direction === "asc" ? 1 : -1;
      const left = sort.key === "student" ? a.student.id : a[sort.key];
      const right = sort.key === "student" ? b.student.id : b[sort.key];
      if (typeof left === "number" || typeof right === "number") {
        return (((left ?? -Infinity) as number) - ((right ?? -Infinity) as number)) * direction;
      }
      return String(left || "").localeCompare(String(right || ""), "ja") * direction;
    });
  }, [activeQuickFilters, assignmentFilter, campusFilter, courseCategoryFilter, courseFilter, dueWeekFilter, examFilter, goalDepartmentFilter, goalFacultyFilter, goalUniversityFilter, gradeFilter, groupFilter, rows, scoreMax, scoreMin, searchKeyword, sort, subjectFilter, submissionFilter, viewMode, yearFilter]);

  const visibleRows = useMemo<Row[]>(() => {
    const min = scoreMin === "" ? null : Number(scoreMin);
    const max = scoreMax === "" ? null : Number(scoreMax);
    const active = new Set(activeQuickFilters);
    const filteredIds = new Set(filteredRows.map((row) => row.student.id));
    const teacher1092FallbackRows = campusFilterMatchesTeacher1092(campusFilter)
      ? rows.filter((row) => isTeacher1092ProgressRow(row) && !filteredIds.has(row.student.id))
      : [];
    const sourceRows = [...filteredRows, ...teacher1092FallbackRows];

    return sourceRows.flatMap((row): Row[] => {
      const studentAssignments = (assignmentsByStudent.get(row.student.id) || []).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      const studentSubmissions = (submissionsByStudent.get(row.student.id) || []).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      const studentScores = (scoresByStudent.get(row.student.id) || []).sort((a, b) => (b.submittedAt || b.gradedAt || b.importedAt).localeCompare(a.submittedAt || a.gradedAt || a.importedAt));
      const assignmentsForMode = studentAssignments.filter((assignment) => viewMode === "common" ? isCommonExamId(assignment.examId) : !isCommonExamId(assignment.examId));
      const assignmentExamIds = new Set(assignmentsForMode.map((assignment) => assignment.examId));
      const scoreText = viewMode === "common" ? "共通" : "2次";
      const scoresForMode = studentScores.filter((item) => item.courseTitle.includes(scoreText));
      const scoreRows = scoresForMode.map((scoreItem) => {
        const score = typeof scoreItem.score === "number" ? scoreItem.score : null;
        const hasSubmission = Boolean(scoreItem.submittedAt);
        const submissionStatus: Row["submissionStatus"] = !hasSubmission ? "未提出" : score === null ? "点数未入力" : "提出済";
        const benchmark = typeof row.goal?.bRate === "number" ? row.goal.bRate : null;
        return {
          ...row,
          latestAssignmentName: scoreItem.assignmentName,
          subject: scoreItem.subject,
          year: scoreItem.year,
          dueDate: scoreItem.dueDate || "",
          examStatus: (hasSubmission ? "受験済" : "未受験") as Row["examStatus"],
          submissionStatus,
          score,
          benchmarkDiff: score !== null && benchmark !== null ? Number((score - benchmark).toFixed(1)) : null,
          scoreRate: score,
          subjectMaxScore: null,
          lastSubmittedAt: scoreItem.submittedAt || "",
          importedAt: scoreItem.importedAt || "",
          importedScore: scoreItem,
          assignment: undefined,
          submission: undefined,
        } satisfies Row;
      });
      const submissionRows = studentSubmissions
        .filter((submission) => viewMode === "common" ? isCommonExamId(submission.examId) : !isCommonExamId(submission.examId))
        .filter((submission) => !assignmentExamIds.has(submission.examId))
        .map((submission) => {
          const subjectMaxScore = secondarySubjectMaxFromExamId(submission.examId);
          const score = typeof submission.score === "number"
            ? viewMode === "secondary" ? submission.score : Math.round((submission.score / (submission.maxScore || 100)) * 100)
            : null;
          const benchmark = typeof row.goal?.bRate === "number" ? row.goal.bRate : null;
          return {
            ...row,
            latestAssignmentName: examTitle(examsById.get(submission.examId), submission.examId),
            subject: subjectFromExamId(submission.examId),
            year: submission.examId.split("/")[1] || row.year,
            dueDate: "",
            examStatus: "蜿鈴ｨ捺ｸ・" as Row["examStatus"],
            submissionStatus: (submission.status !== "graded" ? "採点待ち" : score === null ? "点数未入力" : "提出済") as Row["submissionStatus"],
            score,
            benchmarkDiff: score !== null && benchmark !== null ? Number((score - benchmark).toFixed(1)) : null,
            scoreRate: viewMode === "secondary" ? secondaryRateFromRawScore(score, subjectMaxScore) : rateFromScore(submission.score, submission.maxScore || 100),
            subjectMaxScore,
            lastSubmittedAt: submission.timestamp,
            importedAt: submission.importedAt || "",
            assignment: undefined,
            submission,
            importedScore: undefined,
          } satisfies Row;
        });
      const scoreTaskKeys = new Set(scoreRows.map((item) => `${item.latestAssignmentName}-${item.subject}-${item.year}`));
      const assignmentRows = assignmentsForMode
        .filter((assignment) => !scoreTaskKeys.has(`${examTitle(examsById.get(assignment.examId), assignment.examId)}-${subjectFromExamId(assignment.examId)}-${assignment.examId.split("/")[1] || ""}`))
        .map((assignment) => {
          const latestSubmission = studentSubmissions.find((submission) => submission.examId === assignment.examId);
          const sourceScore = typeof latestSubmission?.score === "number" ? latestSubmission.score : assignment.score;
          const sourceMaxScore = latestSubmission?.maxScore || assignment.maxScore || 100;
          const subjectMaxScore = secondarySubjectMaxFromExamId(assignment.examId);
          const score = typeof sourceScore === "number"
            ? viewMode === "secondary" ? sourceScore : Math.round((sourceScore / sourceMaxScore) * 100)
            : null;
          const hasSubmission = Boolean(latestSubmission || assignment.submittedAt || typeof assignment.score === "number");
          const submissionStatus: Row["submissionStatus"] = !hasSubmission ? "未提出" : score === null ? "点数未入力" : latestSubmission && latestSubmission.status !== "graded" ? "採点待ち" : "提出済";
          const benchmark = typeof row.goal?.bRate === "number" ? row.goal.bRate : null;
          return {
            ...row,
            latestAssignmentName: examTitle(examsById.get(assignment.examId), assignment.examId),
            subject: subjectFromExamId(assignment.examId),
            year: assignment.examId.split("/")[1] || row.year,
            dueDate: assignment.dueDate,
            examStatus: (hasSubmission ? "受験済" : "未受験") as Row["examStatus"],
            submissionStatus,
            score,
            benchmarkDiff: score !== null && benchmark !== null ? Number((score - benchmark).toFixed(1)) : null,
            scoreRate: viewMode === "secondary" ? secondaryRateFromRawScore(score, subjectMaxScore) : rateFromScore(sourceScore, sourceMaxScore),
            subjectMaxScore,
            lastSubmittedAt: latestSubmission?.timestamp || assignment.submittedAt || "",
            importedAt: latestSubmission?.importedAt || assignment.importedAt || "",
            assignment,
            submission: latestSubmission,
            importedScore: undefined,
          } satisfies Row;
        });
      const expandedRows = [...scoreRows, ...submissionRows, ...assignmentRows];
      if (expandedRows.length > 0) return expandedRows;

      if (viewMode === "common" && (!row.courseCategory || isCommonAssignment(undefined, undefined, row.courseCategory))) {
        return [{
          ...row,
          latestAssignmentName: assignmentFilter || (subjectFilter || yearFilter ? `共通テスト ${[subjectFilter, yearFilter].filter(Boolean).join(" ")}` : "共通テスト演習"),
          subject: subjectFilter || "",
          year: yearFilter || row.year,
          dueDate: "",
          examStatus: "未受験" as Row["examStatus"],
          submissionStatus: "未提出" as Row["submissionStatus"],
          score: null,
          benchmarkDiff: null,
          scoreRate: null,
          subjectMaxScore: null,
          lastSubmittedAt: "",
          importedAt: "",
          assignment: undefined,
          submission: undefined,
          importedScore: undefined,
        } satisfies Row];
      }

      if (viewMode === "secondary" && (!row.courseCategory || isSecondaryAssignment(undefined, undefined, row.courseCategory))) {
        return [{
          ...row,
          latestAssignmentName: assignmentFilter || "大学別2次演習",
          subject: subjectFilter || "",
          year: yearFilter || row.year,
          dueDate: "",
          examStatus: "未受験" as Row["examStatus"],
          submissionStatus: "未提出" as Row["submissionStatus"],
          score: null,
          benchmarkDiff: null,
          scoreRate: null,
          subjectMaxScore: null,
          lastSubmittedAt: "",
          importedAt: "",
          assignment: undefined,
          submission: undefined,
          importedScore: undefined,
        } satisfies Row];
      }

      return [];
    }).filter((row) => {
      if (!matchesViewMode(viewMode, row)) return false;
      if (yearFilter && row.year !== yearFilter) return false;
      if (!assignmentMatches(assignmentFilter, row.latestAssignmentName)) return false;
      if (!subjectMatches(subjectFilter, row.subject)) return false;
      if (dueWeekFilter === "this" && !inThisWeek(row.dueDate)) return false;
      if (dueWeekFilter === "none" && row.dueDate) return false;
      if (submissionFilter && row.submissionStatus !== submissionFilter) return false;
      if (examFilter && row.examStatus !== examFilter) return false;
      if (min !== null && (row.score === null || row.score < min)) return false;
      if (max !== null && (row.score === null || row.score > max)) return false;
      if (active.has("missing") && row.submissionStatus !== "未提出") return false;
      if (active.has("thisWeek") && !inThisWeek(row.dueDate)) return false;
      if (viewMode === "common" && active.has("belowBenchmark") && !isBelowBenchmark(row, viewMode)) return false;
      if (active.has("scoreMissing") && row.score !== null) return false;
      if (active.has("notTaken") && row.examStatus !== "未受験") return false;
      return true;
    });
  }, [activeQuickFilters, assignmentFilter, assignmentsByStudent, campusFilter, dueWeekFilter, examFilter, examsById, filteredRows, rows, scoreMax, scoreMin, scoresByStudent, subjectFilter, submissionFilter, submissionsByStudent, viewMode, yearFilter]);

  const summary = useMemo(() => ({
    total: visibleRows.length,
    missing: visibleRows.filter((row) => row.submissionStatus === "未提出").length,
    dueThisWeekMissing: visibleRows.filter((row) => row.submissionStatus === "未提出" && inThisWeek(row.dueDate)).length,
    goalMissing: visibleRows.filter((row) => !row.goalUniversity).length,
    belowBenchmark: visibleRows.filter((row) => isBelowBenchmark(row, viewMode)).length,
    submittedToday: visibleRows.filter((row) => row.lastSubmittedAt.slice(0, 10) === todayKey()).length,
  }), [visibleRows, viewMode]);
  const belowBenchmarkLabel = "基準点未達";

  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((row) => selectedIds.includes(row.student.id));

  const setSortKey = (key: SortKey) => {
    setSort((current) => current.key === key ? { key, direction: current.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" });
  };
  const toggleQuickFilter = (key: QuickFilter) => {
    setActiveQuickFilters((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  };
  const toggleSelected = (id: string) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  };
  const toggleAllVisible = () => {
    const visibleIds = visibleRows.map((row) => row.student.id);
    setSelectedIds((current) => allVisibleSelected ? current.filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...current, ...visibleIds])));
  };
  const resetFilters = () => {
    setGroupFilter([ALL_GROUP_OPTION]);
    setCampusFilter([]);
    setGradeFilter("高3");
    setGoalUniversityFilter("");
    setGoalFacultyFilter("");
    setGoalDepartmentFilter("");
    setCourseFilter("");
    setCourseCategoryFilter("");
    setAssignmentFilter(viewMode === "common" ? "共通テスト英語2026" : "");
    setYearFilter(viewMode === "common" || viewMode === "secondary" ? "2026" : "");
    setDueWeekFilter("");
    setSubmissionFilter("");
    setExamFilter("");
    setScoreMin("");
    setScoreMax("");
    setSubjectFilter(viewMode === "common" ? "英語" : "");
    setSearchKeyword("");
    setActiveQuickFilters([]);
  };
  const exportRows = (targetRows: Row[], filename: string) => {
    const scoreHeaders = viewMode === "secondary" ? ["配点", "得点率"] : ["基準点との差"];
    const headers = ["生徒ID", "ニックネーム", "所属グループ", "所属校舎", "学年", "志望大学", "志望学部", "志望学科", "受講コース", "コース区分", "最新課題", "締切日", "受験状況", "提出状況", "点数", ...scoreHeaders, "最終提出日"];
    const body = targetRows.map((row) => [
      row.student.id,
      row.nickname,
      row.group,
      row.campus,
      row.grade,
      row.goalUniversity,
      row.goalFaculty,
      row.goalDepartment,
      courseLabel(row.courseCode, row.courseName),
      row.courseCategory,
      row.latestAssignmentName,
      row.dueDate,
      row.examStatus,
      row.submissionStatus,
      row.score ?? "",
      ...(viewMode === "secondary" ? [row.subjectMaxScore ?? "", row.scoreRate ?? ""] : [row.benchmarkDiff ?? ""]),
      row.lastSubmittedAt,
    ].map(csvEscape).join(","));
    const blob = new Blob([[headers.map(csvEscape).join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };
  const selectedRows = rows.filter((row) => selectedIds.includes(row.student.id));
  const commonDeadlineTargetRows = rows.filter((row) => {
    if (commonDeadlineMode === "campus") {
      return commonDeadlineCampuses.length > 0 && commonDeadlineCampuses.includes(row.campus);
    }
    if (commonDeadlineGoalUniversity && row.goalUniversity !== commonDeadlineGoalUniversity) return false;
    if (commonDeadlineGoalFaculty && row.goalFaculty !== commonDeadlineGoalFaculty) return false;
    return Boolean(commonDeadlineGoalUniversity || commonDeadlineGoalFaculty);
  });
  const commonDeadlineTargetIds = Array.from(new Set(commonDeadlineTargetRows.map((row) => row.student.id)));
  const registerBulkAssignment = async () => {
    setBulkMessage("");
    if (!selectedIds.length) {
      setBulkMessage("対象生徒を選択してください。");
      return;
    }
    const res = await fetch("/api/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentIds: selectedIds, examId: bulkExamId, dueDate: bulkDueDate, mode: "update_due_only" }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBulkMessage(data.error || "課題の一括登録に失敗しました。");
      return;
    }
    setBulkMessage(`課題を一括登録しました。新規 ${data.createdCount ?? 0} 件、更新 ${data.updatedCount ?? 0} 件。`);
    await load();
  };
  const registerCommonDeadline = async () => {
    setCommonDeadlineMessage("");
    if (!commonDeadlineExam) {
      setCommonDeadlineMessage("指定した年度・科目の共通テスト演習が見つかりません。");
      return;
    }
    if (commonDeadlineMode === "campus" && !commonDeadlineCampuses.length) {
      setCommonDeadlineMessage("対象校舎を1つ以上選択してください。");
      return;
    }
    if (commonDeadlineMode === "goal" && !commonDeadlineGoalUniversity && !commonDeadlineGoalFaculty) {
      setCommonDeadlineMessage("志望大または志望学部を指定してください。");
      return;
    }
    if (!commonDeadlineTargetIds.length) {
      setCommonDeadlineMessage("条件に一致する生徒がいません。");
      return;
    }
    if (!commonDeadlineDueDate) {
      setCommonDeadlineMessage("締切日を指定してください。");
      return;
    }
    const res = await fetch("/api/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentIds: commonDeadlineTargetIds,
        examId: commonDeadlineExam.id,
        dueDate: commonDeadlineDueDate,
        mode: "update_due_only",
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setCommonDeadlineMessage(data.error || "共通テスト演習の締切設定に失敗しました。");
      return;
    }
    setCommonDeadlineMessage(`設定しました。対象 ${commonDeadlineTargetIds.length} 名 / 新規 ${data.createdCount ?? 0} 件 / 更新 ${data.updatedCount ?? 0} 件`);
    await load();
  };
  const updateGoalRate = async (goal: StudentGoal) => {
    const input = window.prompt("共通テスト目標％を入力してください（40〜100）", String(goal.bRate));
    if (input === null) return;
    const nextRate = Number(input);
    if (!Number.isFinite(nextRate) || nextRate < 40 || nextRate > 100) {
      setError("共通テスト目標％は40〜100の範囲で入力してください。");
      return;
    }

    const response = await fetch("/api/student-goals", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: goal.id,
        studentId: goal.studentId,
        admission: {
          code: goal.admissionCode,
          university: goal.university,
          faculty: goal.faculty,
          department: goal.department,
          method: goal.method,
          schedule: goal.schedule,
          allotment: 0,
          aRate: 0,
          bRate: nextRate,
          cRate: 0,
          dRate: 0,
          searchText: [goal.university, goal.faculty, goal.department].filter(Boolean).join(" "),
        },
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error || "共通テスト目標％の更新に失敗しました。");
      return;
    }

    setError("");
    await load();
  };
  const baseColumns: Column[] = [
    { key: "select", label: "チェック", className: "w-10 text-center", render: (row) => <input type="checkbox" checked={selectedIds.includes(row.student.id)} onChange={() => toggleSelected(row.student.id)} /> },
    { key: "student", label: "生徒ID", render: (row) => <button onClick={() => { setDetailRow(row); setDetailTab("basic"); }} className="font-mono font-bold text-blue-700 underline-offset-2 hover:underline">{row.student.id}</button> },
    { key: "nickname", label: "ニックネーム", render: (row) => <button onClick={() => { setDetailRow(row); setDetailTab("basic"); }} className="font-bold text-blue-700 underline-offset-2 hover:underline">{row.nickname}</button> },
    { key: "group", label: "所属グループ" },
    { key: "campus", label: "所属校舎" },
    { key: "grade", label: "学年" },
    { key: "goalUniversity", label: "志望大学" },
    { key: "goalFaculty", label: "志望学部" },
    { key: "goalDepartment", label: "志望学科" },
    { key: "courseLabel", label: "受講コース", render: (row) => <span className="font-semibold">{courseLabel(row.courseCode, row.courseName)}</span> },
    { key: "courseCategory", label: "コース区分" },
    { key: "latestAssignmentName", label: "課題名" },
    { key: "subject", label: "教科" },
    { key: "dueDate", label: "締切日", render: renderDueDate },
    { key: "examStatus", label: "受験状況", render: (row) => <Badge>{row.examStatus}</Badge> },
    { key: "submissionStatus", label: "提出状況", render: (row) => <Badge>{row.submissionStatus}</Badge> },
    { key: "score", label: "点数", className: "text-right font-mono", render: (row) => row.score ?? "-" },
    { key: "benchmarkDiff", label: "基準点との差", className: "text-right font-mono", render: (row) => row.benchmarkDiff === null ? "-" : <><Badge>{row.benchmarkDiff < 0 ? "基準点未達" : "基準点達成"}</Badge><span className="ml-1">{row.benchmarkDiff > 0 ? "+" : ""}{row.benchmarkDiff}</span></> },
    { key: "scoreRate", label: "配点/得点率", className: "text-right font-mono", render: (row) => row.scoreRate === null ? "-" : <><span>{row.subjectMaxScore ? `${row.subjectMaxScore}点配点` : "配点未設定"}</span><span className="ml-1">{formatRate(row.scoreRate)}</span></> },
    { key: "lastSubmittedAt", label: "最終提出日", render: (row) => localDate(row.lastSubmittedAt) },
    { key: "importedAt", label: "取込日", render: (row) => localDate(row.importedAt) },
    { key: "commonProgress", label: "共通テスト進捗", render: (row) => row.commonProgress },
    { key: "secondaryProgress", label: "2次演習進捗", render: (row) => row.secondaryProgress },
    { key: "missingCount", label: "未提出数", className: "text-right font-mono" },
    { key: "averageScore", label: "平均点", className: "text-right font-mono", render: (row) => row.averageScore ?? "-" },
    { key: "belowBenchmarkCount", label: "基準点未達数", className: "text-right font-mono" },
    { key: "note", label: "備考", render: (row) => safeText(row.note) },
    { key: "action", label: "操作", render: (row) => <button onClick={() => { setDetailRow(row); setDetailTab("basic"); }} className="rounded border border-slate-300 px-2 py-1 font-semibold hover:bg-slate-100">詳細</button> },
  ];
  const columnByKey = new Map(baseColumns.map((column) => [column.key, column]));
  const tableKeys: Column["key"][] = (viewMode === "common"
    ? ["select", "student", "nickname", "group", "campus", "grade", "goalUniversity", "courseLabel", "latestAssignmentName", "subject", "dueDate", "examStatus", "submissionStatus", "score", "benchmarkDiff", "lastSubmittedAt", "action"]
    : ["select", "student", "nickname", "group", "campus", "grade", "goalUniversity", "goalFaculty", "courseLabel", "latestAssignmentName", "subject", "dueDate", "submissionStatus", "score", "scoreRate", "lastSubmittedAt", "importedAt", "action"]) as Column["key"][];
  const tableColumns = tableKeys
    .map((key) => columnByKey.get(key)!)
    .filter(Boolean);
  const minTableWidth = "min-w-[1550px]";

  if (loading) return <main className="min-h-screen bg-slate-100 p-6 text-slate-700">読み込み中...</main>;
  if (!user || user.role !== "teacher") {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-xl rounded border border-slate-200 bg-white p-6 shadow-sm">
          <LogIn className="mb-3 h-8 w-8 text-blue-600" />
          <h1 className="text-xl font-bold text-slate-900">教師ログインが必要です</h1>
          <p className="mt-2 text-sm text-slate-600">教師管理画面を開くには教師アカウントでログインしてください。</p>
          <Link href="/login" className="mt-5 inline-flex rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white">ログインへ</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-[0.22em] text-blue-600">TEACHER OPERATIONS</p>
            <h1 className="mt-1 text-2xl font-bold">教師管理一覧</h1>
          </div>
        </div>
      </header>

      <section className="hidden border-b border-slate-200 bg-white px-5 py-4">
        <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold tracking-[0.18em] text-blue-700">COMMON TEST DEADLINE</p>
              <h2 className="text-lg font-bold text-slate-950">共通テスト演習マップ 締切設定</h2>
              <p className="mt-1 text-xs font-semibold text-slate-600">校舎を複数選択、または志望大で絞り込んで、年度・科目ごとのマーク式演習の締切を一括設定します。</p>
            </div>
            <div className="rounded border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-900">
              対象予定: {commonDeadlineTargetIds.length} 名
            </div>
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            <button
              onClick={() => setCommonDeadlineMode("campus")}
              className={`rounded border px-3 py-2 text-xs font-bold ${commonDeadlineMode === "campus" ? "border-blue-700 bg-blue-700 text-white" : "border-slate-300 bg-white text-slate-700"}`}
            >
              校舎で指定
            </button>
            <button
              onClick={() => setCommonDeadlineMode("goal")}
              className={`rounded border px-3 py-2 text-xs font-bold ${commonDeadlineMode === "goal" ? "border-blue-700 bg-blue-700 text-white" : "border-slate-300 bg-white text-slate-700"}`}
            >
              志望大で指定
            </button>
          </div>

          <div className="grid gap-3 lg:grid-cols-6">
            {commonDeadlineMode === "campus" ? (
              <div className="lg:col-span-2">
                <MultiSelect
                  label="対象校舎（複数選択可）"
                  values={options.campuses}
                  selected={commonDeadlineCampuses}
                  onChange={setCommonDeadlineCampuses}
                />
              </div>
            ) : (
              <>
                <label className="space-y-1 text-xs font-semibold text-slate-600">
                  <span>志望大学</span>
                  <select value={commonDeadlineGoalUniversity} onChange={(e) => setCommonDeadlineGoalUniversity(e.target.value)} className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm">
                    <option value="">指定なし</option>
                    {options.universities.map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
                <label className="space-y-1 text-xs font-semibold text-slate-600">
                  <span>志望学部</span>
                  <select value={commonDeadlineGoalFaculty} onChange={(e) => setCommonDeadlineGoalFaculty(e.target.value)} className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm">
                    <option value="">指定なし</option>
                    {options.faculties.map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </label>
              </>
            )}
            <label className="space-y-1 text-xs font-semibold text-slate-600">
              <span>年度</span>
              <select value={commonDeadlineYear} onChange={(e) => setCommonDeadlineYear(e.target.value)} className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm">
                {commonDeadlineYearOptions.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs font-semibold text-slate-600">
              <span>科目</span>
              <select value={commonDeadlineSubject} onChange={(e) => setCommonDeadlineSubject(e.target.value)} className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm">
                {commonDeadlineSubjectOptions.map((value) => <option key={value} value={value}>{commonSubjectLabel(value)}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs font-semibold text-slate-600">
              <span>締切日</span>
              <input type="date" value={commonDeadlineDueDate} onChange={(e) => setCommonDeadlineDueDate(e.target.value)} className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm" />
            </label>
            <div className="flex items-end">
              <button onClick={registerCommonDeadline} className="w-full rounded bg-blue-700 px-3 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-800">
                締切を設定
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600">
            <span>演習: {commonDeadlineExam ? examTitle(commonDeadlineExam, commonDeadlineExam.id) : "未選択"}</span>
            {commonDeadlineMessage && <span className="text-blue-800">{commonDeadlineMessage}</span>}
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white px-5 py-3">
        <div className="grid gap-2 text-xs font-semibold text-slate-700 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">表示中 <span className="text-lg text-slate-950">{summary.total}</span> 人</div>
          <div className="rounded border border-slate-200 bg-rose-50 px-3 py-2">未提出あり <span className="text-lg text-rose-700">{summary.missing}</span> 人</div>
          <div className="rounded border border-slate-200 bg-amber-50 px-3 py-2">今週締切未提出 <span className="text-lg text-amber-700">{summary.dueThisWeekMissing}</span> 人</div>
          <div className="rounded border border-slate-200 bg-violet-50 px-3 py-2">志望校未登録 <span className="text-lg text-violet-700">{summary.goalMissing}</span> 人</div>
          {viewMode === "common" && <div className="rounded border border-slate-200 bg-rose-50 px-3 py-2">{belowBenchmarkLabel} <span className="text-lg text-rose-700">{summary.belowBenchmark}</span> 人</div>}
          <div className="rounded border border-slate-200 bg-emerald-50 px-3 py-2">本日提出あり <span className="text-lg text-emerald-700">{summary.submittedToday}</span> 人</div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white px-5 py-3">
        <div className="flex flex-wrap gap-2">
          {viewModes.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setViewMode(key)}
              className={`rounded border px-4 py-2 text-sm font-bold ${viewMode === key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="border-b border-slate-200 bg-slate-50 px-5 py-4">
        {error && <div className="mb-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</div>}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><Filter className="h-4 w-4 text-blue-600" /> 基本フィルター</div>
          <div className="flex gap-2">
            <button onClick={() => setDetailFiltersOpen((open) => !open)} className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
              {detailFiltersOpen ? "詳細条件を閉じる" : "詳細条件を開く"}
            </button>
            <button onClick={resetFilters} className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">条件クリア</button>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <MultiSelect label="所属グループ" values={options.groups} selected={groupFilter} onChange={(next) => setGroupFilter(next.length ? next : [ALL_GROUP_OPTION])} />
          <div className="space-y-1">
            <MultiSelect label="所属校舎（複数選択）" values={options.campuses} selected={campusFilter} onChange={setCampusFilter} />
            <div className="flex gap-1">
              <button onClick={() => setCampusFilter([])} className="rounded border px-2 py-1 text-[11px] font-semibold">全校舎</button>
              <button onClick={() => setCampusFilter(options.campuses)} className="rounded border px-2 py-1 text-[11px] font-semibold">表示中校舎を選択</button>
            </div>
          </div>
          <label className="space-y-1 text-xs font-semibold text-slate-600">学年
            <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm"><option value="">すべて</option>{options.grades.map((v) => <option key={v}>{v}</option>)}</select>
          </label>
          {viewMode === "secondary" && (
            <label className="space-y-1 text-xs font-semibold text-slate-600">志望大学
              <select value={goalUniversityFilter} onChange={(e) => setGoalUniversityFilter(e.target.value)} className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm"><option value="">すべて</option>{options.universities.map((v) => <option key={v}>{v}</option>)}</select>
            </label>
          )}
          {viewMode === "secondary" && (
            <label className="space-y-1 text-xs font-semibold text-slate-600">受講コース
              <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm"><option value="">すべて</option>{courses.map((course) => <option key={course.code} value={course.code}>{courseLabel(course.code, course.name)}</option>)}</select>
            </label>
          )}
          {(viewMode === "common" || viewMode === "secondary") && (
            <label className="space-y-1 text-xs font-semibold text-slate-600">年度
              <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm"><option value="">すべて</option>{options.years.map((v) => <option key={v}>{v}</option>)}</select>
            </label>
          )}
          {(viewMode === "common" || viewMode === "secondary") && (
            <label className="space-y-1 text-xs font-semibold text-slate-600">教科
              <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm"><option value="">すべて</option>{options.subjects.map((v) => <option key={v}>{v}</option>)}</select>
            </label>
          )}
          {(viewMode === "common" || viewMode === "secondary") && (
            <label className="space-y-1 text-xs font-semibold text-slate-600">課題名
              <select value={assignmentFilter} onChange={(e) => setAssignmentFilter(e.target.value)} className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm"><option value="">すべて</option>{options.assignments.map((v) => <option key={v}>{v}</option>)}</select>
            </label>
          )}
          {(viewMode === "common" || viewMode === "secondary") && (
            <label className="space-y-1 text-xs font-semibold text-slate-600">提出状況
              <select value={submissionFilter} onChange={(e) => setSubmissionFilter(e.target.value)} className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm"><option value="">すべて</option><option>未提出</option><option>提出済</option><option>採点待ち</option><option>点数未入力</option></select>
            </label>
          )}
          <label className="space-y-1 text-xs font-semibold text-slate-600 xl:col-span-2">生徒ID／ニックネーム検索
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)} className="w-full rounded border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm" placeholder="例: 10000002 / サメの集中力020" />
            </div>
          </label>
          <div className="flex flex-wrap items-end gap-2">
            {((viewMode === "secondary" ? ["missing"] : ["missing", "belowBenchmark"]) as QuickFilter[]).map((key) => {
              const label = key === "missing" ? "未提出ありのみ" : (viewMode === "secondary" ? "60%未満のみ" : "基準点未達のみ");
              return <button key={key} onClick={() => toggleQuickFilter(key)} className={`rounded-full border px-3 py-2 text-xs font-semibold ${activeQuickFilters.includes(key) ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-300 bg-white text-slate-600"}`}>{label}</button>;
            })}
          </div>
        </div>
        {detailFiltersOpen && (
          <div className="mt-4 rounded border border-slate-200 bg-white p-3">
            <div className="mb-3 text-sm font-bold text-slate-800">詳細フィルター</div>
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
              <label className="space-y-1 text-xs font-semibold text-slate-600">志望大学
                <select value={goalUniversityFilter} onChange={(e) => setGoalUniversityFilter(e.target.value)} className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm"><option value="">すべて</option>{options.universities.map((v) => <option key={v}>{v}</option>)}</select>
              </label>
              <label className="space-y-1 text-xs font-semibold text-slate-600">志望学部
                <select value={goalFacultyFilter} onChange={(e) => setGoalFacultyFilter(e.target.value)} className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm"><option value="">すべて</option>{options.faculties.map((v) => <option key={v}>{v}</option>)}</select>
              </label>
              <label className="space-y-1 text-xs font-semibold text-slate-600">志望学科
                <select value={goalDepartmentFilter} onChange={(e) => setGoalDepartmentFilter(e.target.value)} className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm"><option value="">すべて</option>{options.departments.map((v) => <option key={v}>{v}</option>)}</select>
              </label>
              <label className="space-y-1 text-xs font-semibold text-slate-600">コース区分
                <select value={courseCategoryFilter} onChange={(e) => setCourseCategoryFilter(e.target.value)} className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm"><option value="">すべて</option>{options.courseCategories.map((v) => <option key={v}>{v}</option>)}</select>
              </label>
              <label className="space-y-1 text-xs font-semibold text-slate-600">締切週
                <select value={dueWeekFilter} onChange={(e) => setDueWeekFilter(e.target.value)} className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm"><option value="">すべて</option><option value="this">今週締切</option><option value="none">締切未設定</option></select>
              </label>
              <label className="space-y-1 text-xs font-semibold text-slate-600">受験状況
                <select value={examFilter} onChange={(e) => setExamFilter(e.target.value)} className="w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm"><option value="">すべて</option><option>受験済</option><option>未受験</option></select>
              </label>
              <label className="space-y-1 text-xs font-semibold text-slate-600 xl:col-span-2">点数範囲
                <div className="flex gap-2">
                  <input value={scoreMin} onChange={(e) => setScoreMin(e.target.value)} placeholder="下限" type="number" min="0" className="w-full rounded border border-slate-300 px-2 py-2 text-sm" />
                  <input value={scoreMax} onChange={(e) => setScoreMax(e.target.value)} placeholder="上限" type="number" min="0" className="w-full rounded border border-slate-300 px-2 py-2 text-sm" />
                </div>
              </label>
              <div className="flex flex-wrap items-end gap-2 xl:col-span-4">
                {quickFilters.filter(([key]) => viewMode === "common" || key !== "belowBenchmark").map(([key, label]) => (
                  <button key={key} onClick={() => toggleQuickFilter(key)} className={`rounded-full border px-3 py-2 text-xs font-semibold ${activeQuickFilters.includes(key) ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-300 bg-white text-slate-600"}`}>{label}</button>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="border-b border-slate-200 bg-white px-5 py-3">
        <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr]">
          <div className="flex flex-wrap items-center gap-2">
            <CheckSquare className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-bold">一括操作: {selectedIds.length} 人選択中</span>
            <button onClick={() => exportRows(selectedRows, "selected-students.csv")} className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold">選択生徒をCSV出力</button>
            <button onClick={() => exportRows(visibleRows.filter((row) => row.submissionStatus === "未提出"), "missing-students.csv")} className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold">未提出者だけCSV出力</button>
          </div>
          <div className="hidden flex-wrap items-center gap-2">
            <select value={bulkExamId} onChange={(e) => setBulkExamId(e.target.value)} className="min-w-56 rounded border border-slate-300 px-2 py-1.5 text-xs">
              {exams.map((exam) => <option key={exam.id} value={exam.id}>{examTitle(exam, exam.id)}</option>)}
            </select>
            <input type="date" value={bulkDueDate} onChange={(e) => setBulkDueDate(e.target.value)} className="rounded border border-slate-300 px-2 py-1.5 text-xs" />
            <button onClick={registerBulkAssignment} className="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white">課題を一括登録 / 締切日を一括設定</button>
            {bulkMessage && <span className="text-xs font-semibold text-slate-600">{bulkMessage}</span>}
          </div>
        </div>
      </section>

      <section className="px-5 py-4">
        <div className="overflow-hidden rounded border border-slate-300 bg-white shadow-sm">
          <div className="max-h-[calc(100vh-360px)] min-h-[420px] overflow-auto">
            <table className={`${minTableWidth} border-collapse text-xs`}>
              <thead className="sticky top-0 z-10 bg-slate-900 text-white">
                <tr>
                  {tableColumns.map((column) => {
                    const label = column.key === "latestAssignmentName"
                      ? viewMode === "common" ? "共通テスト課題名" : viewMode === "secondary" ? "2次演習課題名" : column.label
                      : column.label;
                    return (
                    <th key={column.key} className={`whitespace-nowrap border-r border-slate-700 px-2 py-2 text-left ${column.className || ""}`}>
                      {column.key === "select" ? (
                        <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} />
                      ) : column.key === "action" || column.key === "courseLabel" ? (
                        <span className="font-bold">{label}</span>
                      ) : (
                        <button onClick={() => setSortKey(column.key as SortKey)} className="inline-flex items-center gap-1 font-bold">
                          {label}<ArrowUpDown className="h-3 w-3" />
                        </button>
                      )}
                    </th>
                  )})}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, index) => (
                  <tr key={rowKey(row, index)} className={`${index % 2 === 0 ? "bg-white" : "bg-slate-50"} hover:bg-blue-50`}>
                    {tableColumns.map((column) => (
                      <td key={column.key} className={`border-r border-b border-slate-200 px-2 py-2 ${column.className || ""}`}>
                        {column.render ? column.render(row) : safeText(row[column.key as keyof Row] as string | number | null)}
                      </td>
                    ))}
                  </tr>
                ))}
                {visibleRows.length === 0 && (
                  <tr><td colSpan={tableColumns.length} className="px-4 py-10 text-center text-sm text-slate-500">条件に一致する生徒がいません。</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {detailRow && (
        <div className="fixed inset-0 z-[9999] overflow-auto bg-slate-950/50 p-4 pt-24 backdrop-blur-sm">
          <div className="mx-auto flex max-h-[92vh] max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-xs font-bold tracking-[0.18em] text-blue-600">STUDENT DETAIL</p>
                <h2 className="text-xl font-bold">{detailRow.student.id} / {detailRow.nickname}</h2>
              </div>
              <button onClick={() => setDetailRow(null)} className="rounded p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex gap-1 overflow-x-auto border-b border-slate-200 px-4 pt-3">
              {tabs.map(([key, label]) => (
                <button key={key} onClick={() => setDetailTab(key)} className={`whitespace-nowrap rounded-t px-3 py-2 text-sm font-semibold ${detailTab === key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>{label}</button>
              ))}
            </div>
            <div className="overflow-auto p-5">
              {detailTab === "basic" && (
                <dl className="grid gap-3 md:grid-cols-2">
                  {[
                    ["生徒ID", detailRow.student.id],
                    ["ニックネーム", detailRow.nickname],
                    ["所属グループ", detailRow.group],
                    ["所属校舎", detailRow.campus],
                    ["学年", detailRow.grade],
                    ["志望大学", detailRow.goalUniversity],
                    ["志望学部", detailRow.goalFaculty],
                    ["志望学科", detailRow.goalDepartment],
                    ["受講コースコード", detailRow.courseCode],
                    ["受講コース名", detailRow.courseName],
                    ["コース区分", detailRow.courseCategory],
                    ["備考", detailRow.note],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
                      <dt className="text-xs font-bold text-slate-500">{label}</dt>
                      <dd className="mt-1 font-semibold text-slate-900">{safeText(value)}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {detailTab === "goal" && (
                <div className="space-y-2">
                  {(goalsByStudent.get(detailRow.student.id) || []).map((goal) => (
                    <div key={goal.id} className="rounded border border-slate-200 p-3 text-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-bold">{goal.university} {goal.faculty} {goal.department}</div>
                          <div className="text-slate-600">方式: {safeText(goal.method)} / 日程: {safeText(goal.schedule)} / 共通テスト目標: {safeText(goal.bRate)}%</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => updateGoalRate(goal)}
                          className="rounded border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100"
                        >
                          目標％変更
                        </button>
                      </div>
                    </div>
                  ))}
                  {(goalsByStudent.get(detailRow.student.id) || []).length === 0 && <p className="text-sm text-slate-500">志望校は未登録です。</p>}
                </div>
              )}
              {detailTab === "course" && (
                <div className="space-y-2">
                  {(enrollmentsByStudent.get(detailRow.student.id) || []).map((enrollment) => (
                    <div key={`${enrollment.studentId}-${enrollment.courseCode}`} className="rounded border border-slate-200 p-3 text-sm">
                      <div className="font-bold">{courseLabel(enrollment.courseCode, enrollment.courseName)}</div>
                      <div className="text-slate-600">{safeText(enrollment.courseCategory)} / 年度: {safeText(enrollment.year)}</div>
                    </div>
                  ))}
                  {(enrollmentsByStudent.get(detailRow.student.id) || []).length === 0 && <p className="text-sm text-slate-500">受講コースは未登録です。</p>}
                </div>
              )}
              {detailTab === "assignments" && (
                <div className="space-y-2">
                  {(assignmentsByStudent.get(detailRow.student.id) || []).map((assignment) => (
                    <div key={assignment.id} className="rounded border border-slate-200 p-3 text-sm">
                      <div className="font-bold">{examTitle(examsById.get(assignment.examId), assignment.examId)}</div>
                      <div className="text-slate-600">締切日: {assignment.dueDate}</div>
                    </div>
                  ))}
                  {(assignmentsByStudent.get(detailRow.student.id) || []).length === 0 && <p className="text-sm text-slate-500">課題は未登録です。</p>}
                </div>
              )}
              {detailTab === "progress" && (
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded border border-slate-200 bg-slate-50 p-3"><div className="text-xs font-bold text-slate-500">受験状況</div><div className="mt-2"><Badge>{detailRow.examStatus}</Badge></div></div>
                  <div className="rounded border border-slate-200 bg-slate-50 p-3"><div className="text-xs font-bold text-slate-500">提出状況</div><div className="mt-2"><Badge>{detailRow.submissionStatus}</Badge></div></div>
                  <div className="rounded border border-slate-200 bg-slate-50 p-3"><div className="text-xs font-bold text-slate-500">点数</div><div className="mt-2 text-2xl font-bold">{detailRow.score ?? "-"}</div></div>
                </div>
              )}
              {detailTab === "submissions" && (
                <div className="space-y-2">
                  {(submissionsByStudent.get(detailRow.student.id) || []).map((submission) => (
                    <div key={submission.id} className="rounded border border-slate-200 p-3 text-sm">
                      <div className="font-bold">{examTitle(examsById.get(submission.examId), submission.examId)}</div>
                      <div className="text-slate-600">提出日: {localDate(submission.timestamp)} / 状態: {submission.status} / 点数: {safeText(submission.score)}</div>
                    </div>
                  ))}
                  {(submissionsByStudent.get(detailRow.student.id) || []).length === 0 && <p className="text-sm text-slate-500">提出履歴はありません。</p>}
                </div>
              )}
              {detailTab === "scores" && (
                <div className="space-y-2">
                  {(submissionsByStudent.get(detailRow.student.id) || [])
                    .filter((submission) => typeof submission.score === "number")
                    .map((submission) => (
                      <div key={submission.id} className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm">
                        <div className="font-bold">{examTitle(examsById.get(submission.examId), submission.examId)}</div>
                        <div className="text-slate-700">
                          取込/採点点数: {safeText(submission.score)} / {safeText(submission.maxScore || 100)} / 提出日: {localDate(submission.timestamp)} / 採点日: {localDate(submission.gradedAt)}
                        </div>
                      </div>
                    ))}
                  {(scoresByStudent.get(detailRow.student.id) || []).map((score) => (
                    <div key={`${score.courseTitle}-${score.assignmentName}-${score.round}`} className="rounded border border-slate-200 p-3 text-sm">
                      <div className="font-bold">{score.courseTitle} / {score.assignmentName}</div>
                      <div className="text-slate-600">教科: {safeText(score.subject)} / 回数: {safeText(score.round)} / 点数: {safeText(score.score)} / 提出日: {safeText(score.submittedAt)} / 採点日: {safeText(score.gradedAt)}</div>
                    </div>
                  ))}
                  {(scoresByStudent.get(detailRow.student.id) || []).length === 0 && (submissionsByStudent.get(detailRow.student.id) || []).filter((submission) => typeof submission.score === "number").length === 0 && <p className="text-sm text-slate-500">点数CSVからの履歴はありません。</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
