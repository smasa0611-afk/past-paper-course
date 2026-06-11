import fs from "fs";
import path from "path";

const root = process.cwd();
const assignmentsPath = path.join(root, "data", "assignments.json");
const submissionsRoot = path.join(root, "local-data", "submissions");

const years = Array.from({ length: 10 }, (_, index) => 2026 - index);

const demoTargets = [
  { studentId: "10000002", target: "todai", course: "common", maxScore: 120, baseRate: 0.46 },
  { studentId: "10000003", target: "nagoya", course: "common", maxScore: 300, baseRate: 0.44 },
  { studentId: "10000004", target: "kyodai", course: "common", maxScore: 150, baseRate: 0.48 },
  { studentId: "10000005", target: "hamamatsu_medical", course: "medicine", maxScore: 200, baseRate: 0.43 },
  { studentId: "10000007", target: "nagoya", course: "common", maxScore: 300, baseRate: 0.47 },
];

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function examIdFor(target, year, course) {
  return `${target}/${year}/english/${course}`;
}

function assignmentId(studentId, examId) {
  return `assignment-${studentId}-${examId.replaceAll("/", "-")}`;
}

function submissionId(studentId, examId) {
  return `imported-secondary-demo-${studentId}-${examId.replaceAll("/", "-")}`;
}

function scoreFor(targetIndex, yearIndex, maxScore, baseRate) {
  const drift = ((targetIndex + yearIndex) % 5) * 0.012 - 0.018;
  const yearLift = yearIndex < 3 ? 0.018 - yearIndex * 0.006 : 0;
  const rate = Math.min(0.5, Math.max(0.4, baseRate + drift + yearLift));
  return Math.round(maxScore * rate);
}

const currentAssignments = readJson(assignmentsPath, []);
const generatedAssignmentIds = new Set();
const nextAssignments = currentAssignments.filter((assignment) => {
  const isGenerated = /^assignment-1000000[2-57]-/.test(assignment.id ?? "") &&
    /^(todai|kyodai|nagoya|hamamatsu_medical)\/20(1[7-9]|2[0-6])\/english\//.test(assignment.examId ?? "");
  if (isGenerated) generatedAssignmentIds.add(assignment.id);
  return !isGenerated;
});

let created = 0;

demoTargets.forEach((targetConfig, targetIndex) => {
  years.forEach((year, yearIndex) => {
    const examId = examIdFor(targetConfig.target, year, targetConfig.course);
    const score = scoreFor(targetIndex, yearIndex, targetConfig.maxScore, targetConfig.baseRate);
    const submittedAt = new Date(Date.UTC(year, 4, 12 + targetIndex + yearIndex, 9, 0, 0)).toISOString();
    const gradedAt = new Date(Date.UTC(year, 4, 12 + targetIndex + yearIndex, 9, 20, 0)).toISOString();
    const importedAt = "2026-06-12T03:00:00.000Z";
    const id = assignmentId(targetConfig.studentId, examId);
    const subId = submissionId(targetConfig.studentId, examId);

    nextAssignments.push({
      id,
      studentId: targetConfig.studentId,
      examId,
      dueDate: submittedAt.slice(0, 10),
      score,
      maxScore: targetConfig.maxScore,
      submittedAt,
      gradedAt,
      importedAt,
    });

    const submission = {
      id: subId,
      examId,
      studentId: targetConfig.studentId,
      content: [
        "Imported secondary demo score.",
        `Exam: ${examId}`,
        `Score: ${score} / ${targetConfig.maxScore}`,
      ].join("\n"),
      images: [],
      timestamp: submittedAt,
      status: "graded",
      importedAt,
    };
    const grade = {
      examId,
      submissionId: subId,
      score,
      maxScore: targetConfig.maxScore,
      feedback: "Imported secondary demo English score.",
      gradedAt,
      sections: [],
    };
    const dir = path.join(submissionsRoot, ...examId.split("/"), subId);
    writeJson(path.join(dir, "submission.json"), submission);
    writeJson(path.join(dir, "grade.json"), grade);
    created += 1;
  });
});

nextAssignments.sort((a, b) =>
  String(a.studentId).localeCompare(String(b.studentId)) ||
  String(a.dueDate).localeCompare(String(b.dueDate)) ||
  String(a.examId).localeCompare(String(b.examId)),
);

writeJson(assignmentsPath, nextAssignments);

console.log(`Seeded ${created} secondary demo English imported scores.`);
