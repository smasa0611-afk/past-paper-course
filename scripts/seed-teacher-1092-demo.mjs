import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const readJson = (relativePath) => {
  const filePath = path.join(root, relativePath);
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
};

const writeJson = (relativePath, data, spaces = 2, options = {}) => {
  const filePath = path.join(root, relativePath);
  let text = `${JSON.stringify(data, null, spaces)}\n`;
  if (options.powerShellSpacing) {
    text = text.replace(/": "/g, '":  "');
  }
  if (options.bom) {
    text = `\uFEFF${text}`;
  }
  fs.writeFileSync(filePath, text.replace(/\n/g, "\r\n"));
};

const demoTeacherId = "90000001";
const campusCode = "1092";
const examId = "common/2026/english";
const studentIds = Array.from({ length: 30 }, (_, index) => `1092${String(index + 1).padStart(4, "0")}`);
const generatedIdSet = new Set(studentIds);

const goalSeeds = [
  ["000101010110", "東京大学", "文科一類", "前期"],
  ["000101020110", "東京大学", "文科二類", "前期"],
  ["000101030110", "東京大学", "文科三類", "前期"],
  ["000101040110", "東京大学", "理科一類", "前期"],
  ["000101050110", "東京大学", "理科二類", "前期"],
  ["000101060110", "東京大学", "理科三類", "前期"],
  ["004101010110", "一橋大学", "商", "前期"],
  ["006101010110", "東京工業大学", "理学院", "前期"],
  ["008515680230", "筑波大学", "生命環境学群", "後期"],
  ["023510510110", "静岡大学", "情報", "前期"],
];

const scoreSeeds = [94, 88, 81, 76, 72, 69, 64, 58, 53, 47, 41, 36, 83, 62];

const contentForScore = (score, seed) => {
  const answers = {};
  const correctCount = Math.max(1, Math.min(50, Math.round(score / 2)));
  for (let question = 1; question <= 50; question += 1) {
    answers[`q_${question}`] = question <= correctCount ? String(((question + seed) % 4) + 1) : "0";
  }
  return JSON.stringify({ mode: "marksheet", answers, selectedSectionIds: [] }, null, 2);
};

const permissionPath = "data/master-data/employee_school_permissions.json";
const permissions = readJson(permissionPath);
if (!permissions.some((record) => record["社員番号"] === demoTeacherId && record["校舎コード"] === campusCode)) {
  permissions.push({ "社員番号": demoTeacherId, "校舎コード": campusCode });
}
writeJson(permissionPath, permissions, 4, { bom: true, powerShellSpacing: true });

const studentsPath = "data/master-data/master_students.json";
const students = readJson(studentsPath).filter((student) => !generatedIdSet.has(student["生徒ＩＤ"]));
const demoStudents = studentIds.map((studentId, index) => {
  const [goalCode, university, faculty, department] = goalSeeds[index % goalSeeds.length];
  return {
    "生徒ＩＤ": studentId,
    "学校区分": "4",
    "学年区分": "3",
    "高等部校舎コード": campusCode,
    "姓": "****",
    "名": "****",
    "カナ姓": "****",
    "カナ名": "****",
    "メールアドレス": `demo1092-${String(index + 1).padStart(2, "0")}@example.invalid`,
    "志望校コード": goalCode,
    "大学名": university,
    "学部名": faculty,
    "学科名": department,
  };
});
writeJson(studentsPath, [...students, ...demoStudents], 4, { bom: true, powerShellSpacing: true });

const enrollmentsPath = "data/master-data/master_student_course_enrollments.json";
const enrollments = readJson(enrollmentsPath).filter((record) => !generatedIdSet.has(record["生徒ＩＤ"]));
const demoEnrollments = studentIds.map((studentId) => ({
  "年度": "2026",
  "授業区分": "40",
  "講座種類": "65",
  "講座コース区分": "01",
  "生徒ＩＤ": studentId,
}));
writeJson(enrollmentsPath, [...enrollments, ...demoEnrollments], 4, { bom: true, powerShellSpacing: true });

const assignmentsPath = "data/assignments.json";
const assignments = readJson(assignmentsPath).filter((assignment) => (
  !(generatedIdSet.has(assignment.studentId) && assignment.examId === examId)
));
const demoAssignments = studentIds.map((studentId, index) => {
  const hasScore = index < scoreSeeds.length;
  const isOverdueMissing = index >= scoreSeeds.length && index < scoreSeeds.length + 3;
  const isDueUnsetMissing = index >= 26;
  const dueDate = hasScore
    ? (index === 3 ? "2026-05-24" : "2026-06-22")
    : isOverdueMissing
      ? "2026-05-31"
      : isDueUnsetMissing
        ? ""
        : "2026-06-24";
  return {
    id: `assignment-1092-demo-${studentId}-common-2026-english`,
    studentId,
    examId,
    dueDate,
  };
});
writeJson(assignmentsPath, [...assignments, ...demoAssignments], 2);

const submissionsPath = "data/seed-submissions.json";
const submissions = readJson(submissionsPath).filter((submission) => !submission.id.startsWith("seed-1092-demo-"));
const demoSubmissions = scoreSeeds.map((score, index) => {
  const studentId = studentIds[index];
  const hour = String(8 + (index % 8)).padStart(2, "0");
  return {
    id: `seed-1092-demo-${studentId}-common-2026-english`,
    examId,
    studentId,
    content: contentForScore(score, index),
    images: [],
    timestamp: `2026-06-${String(1 + (index % 8)).padStart(2, "0")}T${hour}:10:00.000Z`,
    status: "graded",
    score,
    maxScore: 100,
    feedback: "Demo marksheet graded result generated from question-level answers.",
    gradedAt: `2026-06-${String(1 + (index % 8)).padStart(2, "0")}T${hour}:25:00.000Z`,
  };
});
writeJson(submissionsPath, [...submissions, ...demoSubmissions], 2);

console.log(JSON.stringify({
  teacherPermission: { employeeId: demoTeacherId, campusCode },
  generatedStudents: demoStudents.length,
  generatedEnrollments: demoEnrollments.length,
  generatedAssignments: demoAssignments.length,
  generatedSubmissions: demoSubmissions.length,
  english2026Mix: {
    scored: demoSubmissions.length,
    overdueMissing: demoAssignments.filter((assignment, index) => index >= scoreSeeds.length && assignment.dueDate && assignment.dueDate < "2026-06-12").length,
    futureMissing: demoAssignments.filter((assignment, index) => index >= scoreSeeds.length && assignment.dueDate && assignment.dueDate >= "2026-06-12").length,
    dueUnsetMissing: demoAssignments.filter((assignment) => !assignment.dueDate).length,
  },
}, null, 2));
