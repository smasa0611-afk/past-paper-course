import fs from "fs";
import path from "path";

const root = process.cwd();
const assignmentsPath = path.join(root, "data", "assignments.json");
const submissionsRoot = path.join(root, "local-data", "submissions");

const years = Array.from({ length: 10 }, (_, index) => 2026 - index);

const demoTargets = [
  {
    studentId: "10000002",
    target: "todai",
    course: "common",
    maxScore: 120,
    rates: [0.43, 0.47, 0.51, 0.39, 0.56, 0.44, 0.61, 0.36, 0.49, 0.53],
    secondChallengeRates: { 2026: 0.57, 2022: 0.64 },
  },
  {
    studentId: "10000003",
    target: "nagoya",
    course: "common",
    maxScore: 300,
    rates: [0.38, 0.42, 0.46, 0.50, 0.54, 0.35, 0.59, 0.41, 0.48, 0.62],
    secondChallengeRates: { 2025: 0.52, 2021: 0.45 },
  },
  {
    studentId: "10000004",
    target: "kyodai",
    course: "common",
    maxScore: 150,
    rates: [0.60, 0.45, 0.37, 0.49, 0.53, 0.41, 0.57, 0.34, 0.46, 0.51],
    secondChallengeRates: { 2024: 0.55, 2020: 0.48 },
  },
  {
    studentId: "10000005",
    target: "hamamatsu_medical",
    course: "medicine",
    maxScore: 200,
    rates: [0.36, 0.40, 0.44, 0.48, 0.52, 0.56, 0.39, 0.43, 0.47, 0.61],
    secondChallengeRates: { 2026: 0.46, 2019: 0.50 },
  },
  {
    studentId: "10000007",
    target: "nagoya",
    course: "common",
    maxScore: 300,
    rates: [0.50, 0.54, 0.58, 0.62, 0.42, 0.46, 0.35, 0.39, 0.43, 0.47],
    secondChallengeRates: { 2023: 0.49, 2018: 0.56 },
  },
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

function assignmentId(studentId, examId, attemptIndex) {
  const suffix = attemptIndex > 0 ? `-attempt-${String(attemptIndex + 1).padStart(2, "0")}` : "";
  return `assignment-${studentId}-${examId.replaceAll("/", "-")}${suffix}`;
}

function submissionId(studentId, examId, attemptIndex) {
  const suffix = attemptIndex > 0 ? `-attempt-${String(attemptIndex + 1).padStart(2, "0")}` : "";
  return `imported-secondary-demo-${studentId}-${examId.replaceAll("/", "-")}${suffix}`;
}

function scoreFor(maxScore, rate) {
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
    const attemptRates = [
      targetConfig.rates[yearIndex],
      targetConfig.secondChallengeRates[year],
    ].filter((rate) => typeof rate === "number");

    attemptRates.forEach((rate, attemptIndex) => {
      const score = scoreFor(targetConfig.maxScore, rate);
      const submittedAt = new Date(Date.UTC(year, 4, 12 + targetIndex + yearIndex, 9 + attemptIndex, attemptIndex * 15, 0)).toISOString();
      const gradedAt = new Date(Date.UTC(year, 4, 12 + targetIndex + yearIndex, 9 + attemptIndex, 20 + attemptIndex * 15, 0)).toISOString();
      const importedAt = "2026-06-12T03:00:00.000Z";
      const id = assignmentId(targetConfig.studentId, examId, attemptIndex);
      const subId = submissionId(targetConfig.studentId, examId, attemptIndex);

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
          `Imported secondary demo score (${attemptIndex + 1}).`,
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
        feedback: `Imported secondary demo English score (${attemptIndex + 1}).`,
        gradedAt,
        sections: [],
      };
      const dir = path.join(submissionsRoot, ...examId.split("/"), subId);
      writeJson(path.join(dir, "submission.json"), submission);
      writeJson(path.join(dir, "grade.json"), grade);
      created += 1;
    });
  });
});

nextAssignments.sort((a, b) =>
  String(a.studentId).localeCompare(String(b.studentId)) ||
  String(a.dueDate).localeCompare(String(b.dueDate)) ||
  String(a.examId).localeCompare(String(b.examId)),
);

writeJson(assignmentsPath, nextAssignments);

console.log(`Seeded ${created} secondary demo English imported scores.`);
