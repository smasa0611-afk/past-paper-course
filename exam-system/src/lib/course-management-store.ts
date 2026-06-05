import path from "path";
import { readJsonFile, writeJsonFileAtomic } from "@/lib/json-file-store";

export type CourseMaster = {
  code: string;
  name: string;
  category: string;
};

export type StudentCourseEnrollment = {
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

export type ImportedScore = {
  studentId: string;
  courseCode?: string;
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

const defaultCourses: CourseMaster[] = [
  { code: "001", name: "共通テスト対策コース", category: "共通テスト" },
  { code: "101", name: "東大2次", category: "大学別2次" },
  { code: "102", name: "京大2次", category: "大学別2次" },
  { code: "103", name: "名大2次", category: "大学別2次" },
  { code: "104", name: "浜医2次", category: "大学別2次" },
];

const dataFile = (name: string) => path.resolve(process.cwd(), "..", "data", name);

const groupCampuses: Record<string, string[]> = {
  "サナル東海（愛知県）": ["高等部豊田本部校", "名古屋校", "岡崎校", "豊橋校"],
  "サナル東海（静岡県）": ["浜松本部校", "静岡本部校", "沼津本部校"],
  "九大進学ゼミ": ["福岡本部校", "久留米校", "熊本校"],
  "スクール21": ["さいたま本部校", "川口校", "越谷校"],
  "中萬学院": ["横浜本部校", "藤沢校", "小田原校"],
};

const demoProfiles = Array.from({ length: 120 }, (_, index) => {
  const id = `9000${String(index + 1).padStart(4, "0")}`;
  const groups = Object.keys(groupCampuses);
  const group = groups[index % groups.length];
  const campus = groupCampuses[group][index % groupCampuses[group].length];
  const courseIndex = index % 4;
  const course = [
    { courseCode: "001", courseName: "共通テスト対策コース", courseCategory: "共通テスト" },
    { courseCode: "101", courseName: "東大2次", courseCategory: "大学別2次" },
    { courseCode: "102", courseName: "京大2次", courseCategory: "大学別2次" },
    { courseCode: "103", courseName: "名大2次", courseCategory: "大学別2次" },
  ][courseIndex];
  const goals = [
    { goalUniversity: "東京大学", goalFaculty: "理科一類", goalDepartment: "" },
    { goalUniversity: "京都大学", goalFaculty: "文学部", goalDepartment: "人文学科" },
    { goalUniversity: "名古屋大学", goalFaculty: "工学部", goalDepartment: "物理工学科" },
    { goalUniversity: "", goalFaculty: "", goalDepartment: "" },
  ][index % 4];
  return {
    id,
    nickname: `確認用${String(index + 1).padStart(2, "0")}`,
    group,
    campus,
    grade: "高3",
    ...goals,
    ...course,
  };
});

function demoEnrollments(): StudentCourseEnrollment[] {
  return demoProfiles.map((profile) => ({
    studentId: profile.id,
    nickname: profile.nickname,
    group: profile.group,
    campus: profile.campus,
    grade: profile.grade,
    goalUniversity: profile.goalUniversity,
    goalFaculty: profile.goalFaculty,
    goalDepartment: profile.goalDepartment,
    courseCode: profile.courseCode,
    courseName: profile.courseName,
    courseCategory: profile.courseCategory,
    year: "2026",
    note: "開発確認用ダミーデータ",
  }));
}

const commonTasks = [
  { title: "共通テスト英語2025", subject: "英語", year: "2025", dueDate: "2026-05-18" },
  { title: "共通テスト英語2026", subject: "英語", year: "2026", dueDate: "2026-05-22" },
  { title: "共通テスト数学2026", subject: "数学", year: "2026", dueDate: "2026-05-23" },
  { title: "共通テスト国語2026", subject: "国語", year: "2026", dueDate: "2026-05-24" },
];
const secondaryTasks = [
  { title: "東大英語2024", course: "東大2次", subject: "英語", year: "2024", dueDate: "2026-05-20" },
  { title: "東大英語2025", course: "東大2次", subject: "英語", year: "2025", dueDate: "2026-05-25" },
  { title: "京大英語2025", course: "京大2次", subject: "英語", year: "2025", dueDate: "2026-05-26" },
  { title: "名大英語2025", course: "名大2次", subject: "英語", year: "2025", dueDate: "2026-05-27" },
  { title: "名大数学2025", course: "名大2次", subject: "数学", year: "2025", dueDate: "2026-05-28" },
];

function scorePayload(index: number, submittedBaseDate: string) {
  const values = [92, 83, 75, 68, 54, 33, undefined, null, 88, 49];
  const value = values[index % values.length];
  if (value === undefined) return { submittedAt: "", gradedAt: "", score: undefined };
  if (value === null) return { submittedAt: submittedBaseDate, gradedAt: "", score: undefined };
  return { submittedAt: submittedBaseDate, gradedAt: "2026-05-15", score: value };
}

function demoScores(): ImportedScore[] {
  const importedAt = "2026-05-15T00:00:00.000Z";
  const scores: ImportedScore[] = [];
  commonTasks.forEach((task, taskIndex) => {
    demoProfiles.slice(taskIndex * 12, taskIndex * 12 + 36).forEach((profile, index) => {
      const payload = scorePayload(index + taskIndex, "2026-05-14");
      scores.push({
        studentId: profile.id,
        courseTitle: "共通テスト演習",
        assignmentName: task.title,
        subject: task.subject,
        year: task.year,
        round: String(taskIndex + 1),
        dueDate: task.dueDate,
        ...payload,
        note: "開発確認用",
        importedAt,
      });
    });
  });
  secondaryTasks.forEach((task, taskIndex) => {
    const targets = demoProfiles.filter((profile) => profile.courseName === task.course).slice(0, 24);
    targets.forEach((profile, index) => {
      const payload = scorePayload(index + taskIndex, "2026-05-14");
      scores.push({
        studentId: profile.id,
        courseTitle: `${task.course}演習`,
        assignmentName: task.title,
        subject: task.subject,
        year: task.year,
        round: String(taskIndex + 1),
        dueDate: task.dueDate,
        ...payload,
        note: "開発確認用",
        importedAt,
      });
    });
  });
  return scores;
}

export function readCourseMaster() {
  return readJsonFile<CourseMaster[]>(dataFile("course_master.json"), defaultCourses);
}

export function readStudentCourseEnrollments() {
  const existing = readJsonFile<StudentCourseEnrollment[]>(dataFile("student_course_enrollments.json"), []);
  const existingKeys = new Set(existing.map((item) => `${item.studentId}-${item.courseCode}`));
  return [...existing, ...demoEnrollments().filter((item) => !existingKeys.has(`${item.studentId}-${item.courseCode}`))];
}

export function writeStudentCourseEnrollments(enrollments: StudentCourseEnrollment[]) {
  writeJsonFileAtomic(dataFile("student_course_enrollments.json"), enrollments);
}

export function readImportedScores() {
  const existing = readJsonFile<ImportedScore[]>(dataFile("imported_scores.json"), []);
  const existingKeys = new Set(existing.map((item) => `${item.studentId}-${item.assignmentName}-${item.round}`));
  return [...existing, ...demoScores().filter((item) => !existingKeys.has(`${item.studentId}-${item.assignmentName}-${item.round}`))];
}

export function writeImportedScores(scores: ImportedScore[]) {
  writeJsonFileAtomic(dataFile("imported_scores.json"), scores);
}
