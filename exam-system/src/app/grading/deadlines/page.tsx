"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckSquare, Loader2, Search } from "lucide-react";
import type { StudentGoal } from "@/types/admissions";
import type { ExamMetadata } from "@/types/exam";

type Student = { id: string; displayName: string; nickname?: string; campus?: string; grade?: string; target?: string };
type Assignment = { id: string; studentId: string; examId: string; dueDate: string };
type Submission = { id: string; examId: string; studentId: string; timestamp: string; status: string; score?: number; maxScore?: number; gradedAt?: string };
type Enrollment = {
  studentId: string;
  nickname?: string;
  group?: string;
  campus?: string;
  grade?: string;
  goalUniversity?: string;
  goalFaculty?: string;
  courseCode: string;
  courseName: string;
  courseCategory: string;
};
type Row = {
  student: Student;
  nickname: string;
  campus: string;
  grade: string;
  goalUniversity: string;
  goalFaculty: string;
  courseName: string;
  assignment?: Assignment;
  assignmentSubject?: string;
  submission?: Submission;
};
type TargetMode = "campus" | "goal";
type Message = { tone: "success" | "error" | "info"; text: string };
type SubmissionFilter = "all" | "unsubmitted" | "submitted" | "graded" | "overdue";
type SortMode = "default" | "dueAsc" | "submission";

const todayKey = () => new Date().toISOString().slice(0, 10);
const safeText = (value?: string | number | null) => (value === undefined || value === null || value === "" ? "-" : String(value));
const isCommonExam = (exam: ExamMetadata) => exam.exam_type === "common" || exam.id.replace(/\\/g, "/").startsWith("common/");
const dueState = (dueDate?: string) => {
  if (!dueDate) return { label: "未設定", className: "bg-slate-100 text-slate-600" };
  if (dueDate < todayKey()) return { label: "締切超過", className: "bg-red-700 px-3 text-sm text-white ring-1 ring-red-950 shadow-[0_5px_14px_rgba(127,29,29,0.25)]" };
  if (dueDate === todayKey()) return { label: "本日締切", className: "bg-amber-100 text-amber-800 ring-1 ring-amber-200" };
  return { label: "締切あり", className: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200" };
};

const SUBJECT_LABELS: Record<string, string> = {
  english: "英語",
  english_listening: "英語リスニング",
  japanese: "国語",
  math_ia: "数学IA",
  math_iibc: "数学IIBC",
  math_iib: "数学IIB",
  information_i: "情報I",
  physics: "物理",
  physics_basics: "物理基礎",
  chemistry: "化学",
  chemistry_basics: "化学基礎",
  biology: "生物",
  biology_basics: "生物基礎",
  earth_science: "地学",
  earth_science_basics: "地学基礎",
  world_history: "世界史",
  world_history_b: "世界史B",
  japanese_history: "日本史",
  japanese_history_b: "日本史B",
  geography: "地理",
  geography_b: "地理B",
  ethics: "倫理",
  ethics_politics_economy: "倫理、政治・経済",
  politics_economy: "政治・経済",
  modern_society: "現代社会",
  public_ethics: "公共・倫理",
  public_politics_economy: "公共・政治経済",
  science_basics: "理科基礎",
  information_related_basics: "情報関係基礎",
  integrated_history_public: "地理総合・歴史総合・公共",
};

const commonSubjectLabel = (value: string) => SUBJECT_LABELS[value] ?? value;
const examTitle = (exam?: ExamMetadata) => exam?.title || (exam ? `共通テスト ${commonSubjectLabel(exam.subject)} ${exam.year}` : "未選択");

function MultiSelect({ options, selected, onChange }: { options: string[]; selected: string[]; onChange: (values: string[]) => void }) {
  return (
    <select
      multiple
      value={selected}
      onChange={(event) => onChange(Array.from(event.currentTarget.selectedOptions).map((option) => option.value))}
      className="h-32 w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

export default function CommonDeadlinePage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [goals, setGoals] = useState<StudentGoal[]>([]);
  const [exams, setExams] = useState<ExamMetadata[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [targetMode, setTargetMode] = useState<TargetMode>("campus");
  const [campuses, setCampuses] = useState<string[]>([]);
  const [goalUniversity, setGoalUniversity] = useState("");
  const [goalFaculty, setGoalFaculty] = useState("");
  const [year, setYear] = useState("2026");
  const [subject, setSubject] = useState("");
  const [dueDate, setDueDate] = useState(todayKey());
  const [searched, setSearched] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [message, setMessage] = useState<Message | null>(null);
  const [submissionFilter, setSubmissionFilter] = useState<SubmissionFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("default");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/students").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/course-management").then((r) => (r.ok ? r.json() : { enrollments: [] })),
      fetch("/api/student-goals").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/exams").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/assignments").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/submissions").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([studentData, courseData, goalData, examData, assignmentData, submissionData]) => {
        if (cancelled) return;
        setStudents(Array.isArray(studentData) ? studentData : []);
        setEnrollments(courseData.enrollments ?? []);
        setGoals(Array.isArray(goalData) ? goalData : []);
        setExams(Array.isArray(examData) ? examData : []);
        setAssignments(Array.isArray(assignmentData) ? assignmentData : []);
        setSubmissions(Array.isArray(submissionData) ? submissionData : []);
      })
      .catch(() => {
        if (!cancelled) setMessage({ tone: "error", text: "締切設定に必要なデータの読み込みに失敗しました。" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const commonExams = useMemo(() => exams.filter(isCommonExam).sort((a, b) => b.year - a.year || a.subject.localeCompare(b.subject)), [exams]);
  const yearOptions = useMemo(() => Array.from(new Set(commonExams.map((exam) => String(exam.year)))).sort((a, b) => b.localeCompare(a)), [commonExams]);
  const subjectOptions = useMemo(() => Array.from(new Set(commonExams.filter((exam) => String(exam.year) === year).map((exam) => exam.subject))).sort(), [commonExams, year]);
  const selectedExam = useMemo(() => commonExams.find((exam) => String(exam.year) === year && exam.subject === subject), [commonExams, subject, year]);
  const selectedExams = useMemo(
    () => commonExams.filter((exam) => String(exam.year) === year && (subject === "all" || exam.subject === subject)),
    [commonExams, subject, year],
  );
  const selectedExamIds = useMemo(() => new Set(selectedExams.map((exam) => exam.id)), [selectedExams]);
  const selectedExamLabel = subject === "all" ? `共通テスト 全科目 ${year}` : examTitle(selectedExam);

  useEffect(() => {
    if (!year && yearOptions[0]) setYear(yearOptions[0]);
    if (!subject && subjectOptions[0]) setSubject(subjectOptions[0]);
    if (subject && subject !== "all" && subjectOptions.length > 0 && !subjectOptions.includes(subject)) setSubject(subjectOptions[0]);
  }, [subject, subjectOptions, year, yearOptions]);

  const enrollmentByStudent = useMemo(() => {
    const map = new Map<string, Enrollment>();
    enrollments.forEach((enrollment) => {
      if (!map.has(enrollment.studentId)) map.set(enrollment.studentId, enrollment);
    });
    return map;
  }, [enrollments]);

  const goalByStudent = useMemo(() => {
    const map = new Map<string, StudentGoal>();
    goals.forEach((goal) => {
      if (!map.has(goal.studentId)) map.set(goal.studentId, goal);
    });
    return map;
  }, [goals]);

  const campusOptions = useMemo(
    () => Array.from(new Set([...students.map((student) => student.campus || ""), ...enrollments.map((enrollment) => enrollment.campus || "")].filter(Boolean))).sort((a, b) => a.localeCompare(b, "ja")),
    [enrollments, students],
  );

  const universityOptions = useMemo(
    () => Array.from(new Set([...goals.map((goal) => goal.university), ...enrollments.map((enrollment) => enrollment.goalUniversity || ""), ...students.map((student) => student.target || "")].filter(Boolean))).sort((a, b) => a.localeCompare(b, "ja")),
    [enrollments, goals, students],
  );

  const facultyOptions = useMemo(
    () => Array.from(new Set([...goals.filter((goal) => !goalUniversity || goal.university === goalUniversity).map((goal) => goal.faculty), ...enrollments.filter((enrollment) => !goalUniversity || enrollment.goalUniversity === goalUniversity).map((enrollment) => enrollment.goalFaculty || "")].filter(Boolean))).sort((a, b) => a.localeCompare(b, "ja")),
    [enrollments, goalUniversity, goals],
  );

  const allRows = useMemo<Row[]>(() => {
    const examById = new Map(selectedExams.map((exam) => [exam.id, exam]));
    const assignmentByStudent = new Map<string, Assignment>();
    assignments
      .filter((assignment) => selectedExamIds.has(assignment.examId))
      .sort((a, b) => {
        const aOverdue = a.dueDate < todayKey();
        const bOverdue = b.dueDate < todayKey();
        if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
        return a.dueDate.localeCompare(b.dueDate);
      })
      .forEach((assignment) => {
        if (!assignmentByStudent.has(assignment.studentId)) assignmentByStudent.set(assignment.studentId, assignment);
      });
    const submissionByStudent = new Map<string, Submission>();
    submissions
      .filter((submission) => selectedExamIds.has(submission.examId))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .forEach((submission) => {
        if (!submissionByStudent.has(submission.studentId)) submissionByStudent.set(submission.studentId, submission);
      });

    return students.map((student) => {
      const enrollment = enrollmentByStudent.get(student.id);
      const goal = goalByStudent.get(student.id);
      const assignment = assignmentByStudent.get(student.id);
      const assignmentExam = assignment ? examById.get(assignment.examId) : undefined;
      return {
        student,
        nickname: enrollment?.nickname || student.nickname || student.displayName || "",
        campus: enrollment?.campus || student.campus || "",
        grade: enrollment?.grade || student.grade || "",
        goalUniversity: enrollment?.goalUniversity || goal?.university || student.target || "",
        goalFaculty: enrollment?.goalFaculty || goal?.faculty || "",
        courseName: enrollment?.courseName || "",
        assignment,
        assignmentSubject: assignmentExam ? commonSubjectLabel(assignmentExam.subject) : undefined,
        submission: submissionByStudent.get(student.id),
      };
    });
  }, [assignments, enrollmentByStudent, goalByStudent, selectedExamIds, selectedExams, students, submissions]);

  const filteredRows = useMemo(() => {
    if (!searched || selectedExams.length === 0) return [];
    const filtered = allRows.filter((row) => {
      if (targetMode === "campus") return campuses.length === 0 || campuses.includes(row.campus);
      if (goalUniversity && row.goalUniversity !== goalUniversity) return false;
      if (goalFaculty && row.goalFaculty !== goalFaculty) return false;
      return Boolean(goalUniversity || goalFaculty);
    });
    const bySubmission = filtered.filter((row) => {
      if (submissionFilter === "all") return true;
      if (submissionFilter === "overdue") return !row.submission && Boolean(row.assignment?.dueDate && row.assignment.dueDate < todayKey());
      if (submissionFilter === "unsubmitted") return !row.submission;
      if (submissionFilter === "graded") return Boolean(row.submission?.gradedAt || row.submission?.status === "graded");
      if (submissionFilter === "submitted") {
        const submission = row.submission;
        return Boolean(submission) && !submission?.gradedAt && submission?.status !== "graded";
      }
      return true;
    });
    return [...bySubmission].sort((a, b) => {
      if (sortMode === "dueAsc") {
        const aDue = a.assignment?.dueDate ?? "9999-99-99";
        const bDue = b.assignment?.dueDate ?? "9999-99-99";
        return aDue.localeCompare(bDue) || a.student.id.localeCompare(b.student.id);
      }
      if (sortMode === "submission") {
        const rank = (row: Row) => (row.submission?.gradedAt || row.submission?.status === "graded" ? 2 : row.submission ? 1 : 0);
        return rank(a) - rank(b) || (a.assignment?.dueDate ?? "9999-99-99").localeCompare(b.assignment?.dueDate ?? "9999-99-99");
      }
      return 0;
    });
  }, [allRows, campuses, goalFaculty, goalUniversity, searched, selectedExams.length, sortMode, submissionFilter, targetMode]);

  const selectedRows = filteredRows.filter((row) => selectedIds.includes(row.student.id));

  const handleSearch = () => {
    setSearched(true);
    setMessage(null);
    setSelectedIds([]);
  };

  const toggleStudent = (studentId: string) => {
    setSelectedIds((current) => current.includes(studentId) ? current.filter((id) => id !== studentId) : [...current, studentId]);
  };

  const registerDeadline = async () => {
    setMessage(null);
    if (selectedExams.length === 0) {
      setMessage({ tone: "error", text: "指定した年度・科目の共通テスト演習が見つかりません。" });
      return;
    }
    if (!dueDate) {
      setMessage({ tone: "error", text: "締切日を指定してください。" });
      return;
    }
    if (selectedIds.length === 0) {
      setMessage({ tone: "error", text: "締切を設定する生徒にチェックを入れてください。" });
      return;
    }

    setSaving(true);
    try {
      let createdCount = 0;
      let updatedCount = 0;
      let latestAssignments = assignments;
      for (const exam of selectedExams) {
        const response = await fetch("/api/assignments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentIds: selectedIds, examId: exam.id, dueDate, mode: "update_due_only" }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          setMessage({ tone: "error", text: data.error || "締切設定に失敗しました。" });
          return;
        }
        createdCount += data.createdCount ?? 0;
        updatedCount += data.updatedCount ?? 0;
        latestAssignments = Array.isArray(data.assignments) ? data.assignments : latestAssignments;
      }
      setAssignments(latestAssignments);
      setMessage({
        tone: "success",
        text: `締切を設定しました。対象 ${selectedIds.length}名 / 科目 ${selectedExams.length}件 / 新規 ${createdCount}件 / 再設定 ${updatedCount}件`,
      });
    } catch {
      setMessage({ tone: "error", text: "締切設定に失敗しました。通信状態を確認してください。" });
    } finally {
      setSaving(false);
    }
  };
  const messageClass =
    message?.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : message?.tone === "error"
        ? "border-rose-200 bg-rose-50 text-rose-800"
        : "border-blue-200 bg-blue-50 text-blue-800";

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white px-6 py-5">
        <Link href="/grading" className="inline-flex items-center gap-2 text-sm font-bold text-blue-700">
          <ArrowLeft className="h-4 w-4" /> 進捗確認へ戻る
        </Link>
        <p className="mt-4 text-xs font-bold uppercase tracking-[0.24em] text-blue-700">Teacher Operations</p>
        <h1 className="text-2xl font-black">共通テスト演習 締切設定</h1>
        <p className="mt-2 text-sm font-semibold text-slate-600">対象生徒を検索し、チェックした生徒へ年度・科目ごとの締切を登録します。</p>
      </header>

      <section className="border-b border-slate-200 bg-blue-50 px-6 py-5">
        <div className="mb-4 flex flex-wrap gap-2">
          <button onClick={() => setTargetMode("campus")} className={`rounded px-4 py-2 text-sm font-bold ${targetMode === "campus" ? "bg-blue-700 text-white" : "border border-slate-300 bg-white"}`}>校舎で指定</button>
          <button onClick={() => setTargetMode("goal")} className={`rounded px-4 py-2 text-sm font-bold ${targetMode === "goal" ? "bg-blue-700 text-white" : "border border-slate-300 bg-white"}`}>志望大で指定</button>
        </div>
        <div className="grid gap-4 xl:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]">
          {targetMode === "campus" ? (
            <label className="space-y-1 text-sm font-bold">
              対象校舎（複数選択可）
              <MultiSelect options={campusOptions} selected={campuses} onChange={setCampuses} />
            </label>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:col-span-2">
              <label className="space-y-1 text-sm font-bold">志望大学
                <select value={goalUniversity} onChange={(event) => setGoalUniversity(event.target.value)} className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm">
                  <option value="">選択してください</option>
                  {universityOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-sm font-bold">志望学部
                <select value={goalFaculty} onChange={(event) => setGoalFaculty(event.target.value)} className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm">
                  <option value="">すべて</option>
                  {facultyOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            </div>
          )}
          <label className="space-y-1 text-sm font-bold">年度
            <select value={year} onChange={(event) => setYear(event.target.value)} className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm">
              {yearOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-bold">科目
            <select value={subject} onChange={(event) => setSubject(event.target.value)} className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="all">すべて</option>
              {subjectOptions.map((option) => <option key={option} value={option}>{commonSubjectLabel(option)}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm font-bold">締切日
            <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm" />
          </label>
          <button onClick={handleSearch} className="inline-flex items-center justify-center gap-2 rounded bg-blue-700 px-5 py-2 text-sm font-black text-white xl:self-end">
            <Search className="h-4 w-4" /> 検索
          </button>
        </div>
        <p className="mt-3 text-xs font-bold text-slate-600">演習: {selectedExamLabel}</p>
      </section>

      <section className="px-6 py-5">
        <div className="mb-3 grid gap-3 rounded border border-slate-200 bg-white p-3 md:grid-cols-2">
          <label className="space-y-1 text-xs font-black text-slate-700">
            提出状況フィルタ
            <select value={submissionFilter} onChange={(event) => setSubmissionFilter(event.target.value as SubmissionFilter)} className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="all">すべて</option>
              <option value="overdue">締切超過のみ</option>
              <option value="unsubmitted">未提出・未受験</option>
              <option value="submitted">提出済み</option>
              <option value="graded">採点済み</option>
            </select>
          </label>
          <label className="space-y-1 text-xs font-black text-slate-700">
            並び替え
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="default">標準</option>
              <option value="dueAsc">締切日の早い順</option>
              <option value="submission">提出状況順</option>
            </select>
          </label>
        </div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-black">検索結果: {loading ? "読み込み中" : `${filteredRows.length}名`} / 選択中: {selectedIds.length}名</div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setSelectedIds(filteredRows.map((row) => row.student.id))} className="rounded border border-slate-300 bg-white px-3 py-2 text-xs font-bold">表示中を全選択</button>
            <button onClick={() => setSelectedIds([])} className="rounded border border-slate-300 bg-white px-3 py-2 text-xs font-bold">選択解除</button>
            <button onClick={registerDeadline} disabled={saving} className="inline-flex items-center gap-2 rounded bg-slate-950 px-4 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckSquare className="h-4 w-4" />}
              {saving ? "登録中..." : "チェックした生徒に締切を登録・再設定"}
            </button>
          </div>
        </div>
        {message && <p className={`mb-3 rounded border px-3 py-2 text-sm font-bold ${messageClass}`}>{message.text}</p>}
        {!searched ? (
          <div className="rounded border border-slate-200 bg-white px-4 py-10 text-center text-sm font-bold text-slate-500">条件を指定して検索してください。</div>
        ) : (
          <div className="overflow-x-auto rounded border border-slate-200 bg-white shadow-sm">
            <table className="min-w-[1280px] w-full border-collapse text-sm">
              <thead className="bg-slate-950 text-white">
                <tr>
                  <th className="w-10 px-3 py-2 text-left"><input type="checkbox" checked={filteredRows.length > 0 && selectedIds.length === filteredRows.length} onChange={(event) => setSelectedIds(event.target.checked ? filteredRows.map((row) => row.student.id) : [])} /></th>
                  {["生徒ID", "ニックネーム", "所属校舎", "学年", "志望大学", "受講コース", "締切日", "受験状況", "提出状況", "点数", "最終提出日"].map((header) => (
                    <th key={header} className="whitespace-nowrap border-l border-slate-700 px-3 py-2 text-left">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const status = dueState(row.assignment?.dueDate);
                  return (
                  <tr key={row.student.id} className="border-t border-slate-200 odd:bg-white even:bg-slate-50">
                    <td className="px-3 py-2"><input type="checkbox" checked={selectedIds.includes(row.student.id)} onChange={() => toggleStudent(row.student.id)} /></td>
                    <td className="px-3 py-2 font-bold text-blue-700">{row.student.id}</td>
                    <td className="px-3 py-2">{safeText(row.nickname)}</td>
                    <td className="px-3 py-2">{safeText(row.campus)}</td>
                    <td className="px-3 py-2">{safeText(row.grade)}</td>
                    <td className="px-3 py-2">{safeText(row.goalUniversity)}</td>
                    <td className="px-3 py-2">{safeText(row.courseName)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold">{row.assignment?.dueDate ?? "-"}</span>
                        <span className={`rounded-full px-2 py-1 text-xs font-black ${status.className}`}>{status.label}</span>
                        {subject === "all" && row.assignmentSubject && <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-black text-blue-700">{row.assignmentSubject}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2">{row.submission ? <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">受験済</span> : <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">未受験</span>}</td>
                    <td className="px-3 py-2">{row.submission?.gradedAt ? "採点済" : row.submission ? "提出済" : "未提出"}</td>
                    <td className="px-3 py-2">{row.submission?.score ?? "-"}</td>
                    <td className="px-3 py-2">{row.submission ? new Date(row.submission.timestamp).toLocaleDateString("ja-JP") : "-"}</td>
                  </tr>
                  );
                })}
                {filteredRows.length === 0 && (
                  <tr><td colSpan={12} className="px-4 py-10 text-center text-sm font-bold text-slate-500">該当する生徒がいません。</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {selectedRows.length > 0 && <p className="mt-3 text-xs font-bold text-slate-600">登録対象: {selectedRows.slice(0, 8).map((row) => row.nickname || row.student.id).join("、")}{selectedRows.length > 8 ? ` ほか${selectedRows.length - 8}名` : ""}</p>}
      </section>
    </main>
  );
}
