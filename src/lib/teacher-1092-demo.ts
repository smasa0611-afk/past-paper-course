import type { Assignment } from "@/lib/assignment-store";
import type { StudentCourseEnrollment } from "@/lib/course-management-store";
import type { StoredSubmission } from "@/lib/submission-storage";

export const teacher1092DemoTeacherId = "90000001";
export const teacher1092DemoCampusCode = "1092";
export const teacher1092DemoExamId = "common/2026/english";

export type Teacher1092DemoStudent = {
  id: string;
  name: string;
  nickname: string;
  displayName: string;
  email: string;
  target: string;
  group: string;
  campus: string;
  grade: string;
  setupComplete: boolean;
};

const studentIds = Array.from({ length: 30 }, (_, index) => `1092${String(index + 1).padStart(4, "0")}`);
const scoreSeeds = [94, 88, 81, 76, 72, 69, 64, 58, 53, 47, 41, 36, 83, 62];
const goals = [
  "東京大学 文科一類 前期",
  "東京大学 文科二類 前期",
  "東京大学 文科三類 前期",
  "東京大学 理科一類 前期",
  "東京大学 理科二類 前期",
  "東京大学 理科三類 前期",
  "一橋大学 商 前期",
  "東京工業大学 理学院 前期",
  "筑波大学 生命環境学群 後期",
  "静岡大学 情報 前期",
];

const splitGoal = (target: string) => {
  const [goalUniversity = "", goalFaculty = "", ...rest] = target.split(" ");
  return { goalUniversity, goalFaculty, goalDepartment: rest.join(" ") };
};

const contentForScore = (score: number, seed: number) => {
  const answers: Record<string, string> = {};
  const correctCount = Math.max(1, Math.min(50, Math.round(score / 2)));
  for (let question = 1; question <= 50; question += 1) {
    answers[`q_${question}`] = question <= correctCount ? String(((question + seed) % 4) + 1) : "0";
  }
  return JSON.stringify({ mode: "marksheet", answers, selectedSectionIds: [] }, null, 2);
};

export function isTeacher1092DemoUser(userId?: string) {
  return userId === teacher1092DemoTeacherId;
}

export const teacher1092DemoStudents: Teacher1092DemoStudent[] = studentIds.map((studentId, index) => ({
  id: studentId,
  name: "",
  nickname: `1092デモ${String(index + 1).padStart(2, "0")}`,
  displayName: `1092デモ${String(index + 1).padStart(2, "0")}`,
  email: `demo1092-${String(index + 1).padStart(2, "0")}@example.invalid`,
  target: goals[index % goals.length],
  group: "高等部静岡本部",
  campus: "高等部北高前校3号館",
  grade: "高3",
  setupComplete: false,
}));

export const teacher1092DemoCourses = [
  {
    code: "01",
    name: "共通テスト過去問対策講座",
    category: "共通テスト演習",
  },
];

export const teacher1092DemoEnrollments: StudentCourseEnrollment[] = teacher1092DemoStudents.map((student, index) => ({
  studentId: student.id,
  nickname: student.nickname,
  group: student.group,
  campus: student.campus,
  grade: student.grade,
  ...splitGoal(student.target),
  courseCode: "01",
  courseName: "共通テスト過去問対策講座",
  courseCategory: "共通テスト演習",
  year: "2026",
  note: "90000001デモ教師用1092校舎データ",
}));

export const teacher1092DemoAssignments: Assignment[] = studentIds.map((studentId, index) => {
  const hasScore = index < scoreSeeds.length;
  const isOverdueMissing = index >= scoreSeeds.length && index < 24;
  return {
    id: `assignment-1092-demo-${studentId}-common-2026-english`,
    studentId,
    examId: teacher1092DemoExamId,
    dueDate: hasScore ? (index % 3 === 0 ? "2026-05-24" : "2026-06-22") : isOverdueMissing ? "2026-05-31" : "",
  };
});

export const teacher1092DemoSubmissions: StoredSubmission[] = scoreSeeds.map((score, index) => {
  const studentId = studentIds[index];
  const day = String(1 + (index % 8)).padStart(2, "0");
  const hour = String(8 + (index % 8)).padStart(2, "0");
  return {
    id: `seed-1092-demo-${studentId}-common-2026-english`,
    examId: teacher1092DemoExamId,
    studentId,
    content: contentForScore(score, index),
    images: [],
    timestamp: `2026-06-${day}T${hour}:10:00.000Z`,
    status: "graded",
    score,
    maxScore: 100,
    feedback: "Demo marksheet graded result generated from question-level answers.",
    gradedAt: `2026-06-${day}T${hour}:25:00.000Z`,
  };
});

export function mergeByKey<T>(items: T[], demoItems: T[], getKey: (item: T) => string) {
  const merged = new Map<string, T>();
  items.forEach((item) => merged.set(getKey(item), item));
  demoItems.forEach((item) => merged.set(getKey(item), item));
  return [...merged.values()];
}
