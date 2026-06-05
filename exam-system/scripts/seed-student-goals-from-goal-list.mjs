import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const workspaceRoot = path.resolve(process.cwd(), "..");
const studentsPath = path.join(workspaceRoot, "data", "students.json");
const admissionsPath = path.join(workspaceRoot, "data", "admissions", "2026_common_admissions.json");
const goalsPath = path.join(workspaceRoot, "data", "student_goals.json");
const sourceWorkbookPath = path.join("C:\\Users\\smasa\\Desktop", "志望校リスト.xlsx");

const students = JSON.parse(fs.readFileSync(studentsPath, "utf8"));
const admissions = JSON.parse(fs.readFileSync(admissionsPath, "utf8"));
const existingGoals = JSON.parse(fs.readFileSync(goalsPath, "utf8"));

const workbook = XLSX.readFile(sourceWorkbookPath);
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

function toCellString(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(Math.trunc(value));
  return String(value).replace(/\.0$/, "").trim();
}

function toHiragana(text) {
  return text.replace(/[\u30a1-\u30f6]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
}

function normalizeJapaneseText(text) {
  return toHiragana(
    String(text ?? "")
      .normalize("NFKC")
      .replace(/[\s/・･()（）-]+/g, "")
      .replace(/全学科学科|全学科|学部共通学科|学部共通|高度工学教育|創造工学教育/g, "")
      .replace(/学部|学科/g, "")
      .toLowerCase(),
  );
}

function longestContainedSubstringLength(goalText, candidateText) {
  let best = 0;
  for (let start = 0; start < candidateText.length; start += 1) {
    for (let end = candidateText.length; end > start + best; end -= 1) {
      const part = candidateText.slice(start, end);
      if (part.length <= best) break;
      if (goalText.includes(part)) {
        best = part.length;
        break;
      }
    }
  }
  return best;
}

function chooseAdmissionRecord(candidates) {
  const schedulePref = ["前", "中", "後", "共"];
  const scheduleFound = schedulePref.find((schedule) =>
    candidates.some((candidate) => candidate.schedule === schedule),
  );
  const scheduleCandidates = scheduleFound
    ? candidates.filter((candidate) => candidate.schedule === scheduleFound)
    : candidates;
  const emptyMethodCandidates = scheduleCandidates.filter(
    (candidate) => !candidate.method || candidate.method.trim().length === 0,
  );
  const methodCandidates =
    emptyMethodCandidates.length > 0 ? emptyMethodCandidates : scheduleCandidates;
  return [...methodCandidates].sort((a, b) => b.bRate - a.bRate)[0];
}

function findApproxAdmission(goalText) {
  const normalizedGoal = normalizeJapaneseText(goalText);
  if (!normalizedGoal) return null;

  const ranked = admissions
    .map((admission) => {
      const universityScore = longestContainedSubstringLength(
        normalizedGoal,
        normalizeJapaneseText(admission.university),
      );
      if (universityScore < 2) return null;

      const facultyScore = longestContainedSubstringLength(
        normalizedGoal,
        normalizeJapaneseText(admission.faculty),
      );
      const departmentScore = longestContainedSubstringLength(
        normalizedGoal,
        normalizeJapaneseText(admission.department),
      );

      return {
        admission,
        totalScore: universityScore * 10000 + facultyScore * 100 + departmentScore,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.totalScore - a.totalScore);

  if (ranked.length === 0) return null;
  const bestScore = ranked[0].totalScore;
  const candidates = ranked
    .filter((item) => item.totalScore === bestScore)
    .map((item) => item.admission);

  return chooseAdmissionRecord(candidates);
}

const excelGoals = new Map();
for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
  const row = rows[rowIndex] ?? [];
  const studentId = toCellString(row[3]);
  const goalText = toCellString(row[5]);
  if (!studentId || !goalText) continue;
  excelGoals.set(studentId, goalText);
}

const studentIdSet = new Set(students.map((student) => String(student.id)));
const nextGoals = existingGoals.filter((goal) => !excelGoals.has(goal.studentId));
const summary = { matched: 0, manual: 0, missingStudent: 0, missingStudentIds: [], manualStudentIds: [] };

for (const [studentId, goalText] of excelGoals.entries()) {
  if (!studentIdSet.has(studentId)) {
    summary.missingStudent += 1;
    summary.missingStudentIds.push(studentId);
    continue;
  }

  const admission = findApproxAdmission(goalText);
  if (admission) {
    nextGoals.push({
      id: `${studentId}-${admission.code}`,
      studentId,
      admissionCode: admission.code,
      university: admission.university,
      faculty: admission.faculty,
      department: admission.department,
      method: admission.method,
      schedule: admission.schedule,
      bRate: admission.bRate,
      createdAt: new Date().toISOString(),
    });
    summary.matched += 1;
    continue;
  }

  summary.manual += 1;
  summary.manualStudentIds.push(studentId);
  nextGoals.push({
    id: `${studentId}-manual-goal`,
    studentId,
    admissionCode: `manual-${studentId}`,
    university: goalText.split(" ")[0] ?? goalText,
    faculty: goalText.split(" ").slice(1, 2).join(" "),
    department: goalText.split(" ").slice(2).join(" "),
    method: "",
    schedule: "",
    bRate: 75,
    createdAt: new Date().toISOString(),
  });
}

fs.writeFileSync(goalsPath, JSON.stringify(nextGoals, null, 2), "utf8");

console.log(JSON.stringify({ ...summary, totalGoals: nextGoals.length }, null, 2));
