import fs from "fs";
import path from "path";

const root = process.cwd();
const assignmentsPath = path.join(root, "data", "assignments.json");
const submissionsRoot = path.join(root, "local-data", "submissions");

const years = Array.from({ length: 10 }, (_, index) => 2026 - index);

const demoTodaiAllSubjectScores = {
  "10000002": {
    2026: {
      english: { course: "common", maxScore: 120, score: 60 },
      math: { course: "science", maxScore: 120, score: 58 },
      japanese: { course: "science", maxScore: 80, score: 40 },
      physics: { course: "science", maxScore: 60, score: 31 },
      chemistry: { course: "science", maxScore: 60, score: 31 },
    },
    2025: {
      english: { course: "common", maxScore: 120, score: 48 },
      math: { course: "science", maxScore: 120, score: 46 },
      japanese: { course: "science", maxScore: 80, score: 32 },
      physics: { course: "science", maxScore: 60, score: 25 },
      chemistry: { course: "science", maxScore: 60, score: 25 },
    },
  },
};

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

function examIdFor(target, year, subject, course) {
  return `${target}/${year}/${subject}/${course}`;
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

function writeLocalJson(filePath, data) {
  try {
    writeJson(filePath, data);
  } catch (error) {
    if (error?.code !== "EPERM" && error?.code !== "EBUSY") throw error;
    console.warn(`Skipped locked local-data file: ${path.relative(root, filePath)}`);
  }
}

const currentAssignments = readJson(assignmentsPath, []);
const nextAssignments = currentAssignments.filter(
  (assignment) =>
    !(
      assignment.studentId === "10000002" &&
      /^todai\/202[56]\/(english|math|japanese|physics|chemistry)\//.test(assignment.examId ?? "")
    ),
);

function upsertAssignment(assignment) {
  const index = nextAssignments.findIndex((item) => item.id === assignment.id);
  if (index >= 0) {
    nextAssignments[index] = assignment;
    return;
  }
  nextAssignments.push(assignment);
}

let created = 0;

demoTargets.forEach((targetConfig, targetIndex) => {
  years.forEach((year, yearIndex) => {
    if (targetConfig.studentId === "10000002" && targetConfig.target === "todai" && demoTodaiAllSubjectScores["10000002"][year]) {
      return;
    }

    const examId = examIdFor(targetConfig.target, year, "english", targetConfig.course);
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

      upsertAssignment({
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
      writeLocalJson(path.join(dir, "submission.json"), submission);
      writeLocalJson(path.join(dir, "grade.json"), grade);
      created += 1;
    });
  });
});

Object.entries(demoTodaiAllSubjectScores).forEach(([studentId, yearlyScores]) => {
  Object.entries(yearlyScores).forEach(([yearText, subjects]) => {
    const year = Number(yearText);
    Object.entries(subjects).forEach(([subject, config], subjectIndex) => {
      const examId = examIdFor("todai", year, subject, config.course);
      const submittedAt = new Date(Date.UTC(year, 4, 20 + (2026 - year), 9, subjectIndex * 8, 0)).toISOString();
      const gradedAt = new Date(Date.UTC(year, 4, 20 + (2026 - year), 9, 20 + subjectIndex * 8, 0)).toISOString();
      const importedAt = "2026-06-12T03:00:00.000Z";
      const id = assignmentId(studentId, examId, 0);
      const subId = submissionId(studentId, examId, 0);

      upsertAssignment({
        id,
        studentId,
        examId,
        dueDate: submittedAt.slice(0, 10),
        score: config.score,
        maxScore: config.maxScore,
        submittedAt,
        gradedAt,
        importedAt,
      });

      const submission = {
        id: subId,
        examId,
        studentId,
        content: [
          "Imported secondary demo score.",
          `Exam: ${examId}`,
          `Score: ${config.score} / ${config.maxScore}`,
        ].join("\n"),
        images: [],
        timestamp: submittedAt,
        status: "graded",
        importedAt,
      };
      const grade = {
        examId,
        submissionId: subId,
        score: config.score,
        maxScore: config.maxScore,
        feedback: "Imported secondary demo all-subject score.",
        gradedAt,
        sections: [],
      };
      const dir = path.join(submissionsRoot, ...examId.split("/"), subId);
      writeLocalJson(path.join(dir, "submission.json"), submission);
      writeLocalJson(path.join(dir, "grade.json"), grade);
      created += 1;
    });
  });
});

writeJson(assignmentsPath, nextAssignments);

console.log(`Seeded ${created} secondary demo imported scores.`);
