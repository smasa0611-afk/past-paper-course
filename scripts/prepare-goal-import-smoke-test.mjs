import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const workspaceRoot = process.cwd();
const goalsPath = path.join(workspaceRoot, "data", "student_goals.json");
const sourceWorkbookPath = path.join("C:\\Users\\smasa\\Desktop", "志望校リスト.xlsx");
const outputDir = path.join(workspaceRoot, "outputs");
const outputPath = path.join(outputDir, "志望校インポート確認用_10名.xlsx");
const TARGET_COUNT = 10;

function toCellString(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(Math.trunc(value));
  return String(value).replace(/\.0$/, "").trim();
}

const goals = JSON.parse(fs.readFileSync(goalsPath, "utf8"));
const workbook = XLSX.readFile(sourceWorkbookPath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

const headerRow = rows[0] ?? [];
const candidateRows = rows
  .slice(1)
  .map((row, index) => ({
    rowIndex: index + 1,
    row,
    studentId: toCellString(row[3]),
    goalText: toCellString(row[5]),
  }))
  .filter((entry) => entry.studentId && entry.goalText);

const chosenRows = [];
const seenStudentIds = new Set();

for (const entry of candidateRows) {
  if (chosenRows.length >= TARGET_COUNT) break;
  if (seenStudentIds.has(entry.studentId)) continue;
  if (!goals.some((goal) => String(goal.studentId) === entry.studentId)) continue;

  chosenRows.push(entry);
  seenStudentIds.add(entry.studentId);
}

if (chosenRows.length < TARGET_COUNT) {
  throw new Error(`取り込みテスト用の生徒を ${TARGET_COUNT} 人確保できませんでした。`);
}

const chosenIds = new Set(chosenRows.map((entry) => entry.studentId));
const nextGoals = goals.filter((goal) => !chosenIds.has(String(goal.studentId)));

fs.writeFileSync(goalsPath, JSON.stringify(nextGoals, null, 2), "utf8");

const outputRows = [headerRow, ...chosenRows.map((entry) => entry.row)];
const outputWorkbook = XLSX.utils.book_new();
const outputSheet = XLSX.utils.aoa_to_sheet(outputRows);
XLSX.utils.book_append_sheet(outputWorkbook, outputSheet, sheetName);
fs.mkdirSync(outputDir, { recursive: true });
XLSX.writeFile(outputWorkbook, outputPath);

console.log(
  JSON.stringify(
    {
      outputPath,
      removedGoalCount: chosenRows.length,
      removedStudentIds: chosenRows.map((entry) => entry.studentId),
      removedStudents: chosenRows.map((entry) => ({
        studentId: entry.studentId,
        name: toCellString(entry.row[4]),
        goalText: entry.goalText,
      })),
    },
    null,
    2,
  ),
);
