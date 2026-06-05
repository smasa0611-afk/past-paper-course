import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const workspaceRoot = process.cwd();
const studentsPath = path.join(workspaceRoot, "data", "students.json");
const sourceWorkbookPath = path.join("C:\\Users\\smasa\\Desktop", "志望校リスト.xlsx");
const outputDir = path.join(workspaceRoot, "outputs");
const outputPath = path.join(outputDir, "志望校リスト_デモ取込用.xlsx");

const students = JSON.parse(fs.readFileSync(studentsPath, "utf8"));
const sourceWorkbook = XLSX.readFile(sourceWorkbookPath);
const sourceSheet = sourceWorkbook.Sheets[sourceWorkbook.SheetNames[0]];
const sourceRows = XLSX.utils.sheet_to_json(sourceSheet, { header: 1, defval: "" });
const headerRow = sourceRows[0] ?? [];

const dataRows = students.map((student) => {
  const row = new Array(Math.max(headerRow.length, 16)).fill("");
  row[1] = student.campus ?? "";
  row[2] = student.grade ?? "";
  row[3] = student.id ?? "";
  row[4] = student.name ?? "";
  row[5] = student.target ?? "";
  return row;
});

const worksheet = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows]);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, sourceWorkbook.SheetNames[0] ?? "Sheet1");

fs.mkdirSync(outputDir, { recursive: true });
XLSX.writeFile(workbook, outputPath);

const blankTargets = students.filter((student) => !String(student.target ?? "").trim()).length;
console.log(
  JSON.stringify(
    {
      outputPath,
      studentCount: students.length,
      blankTargets,
    },
    null,
    2,
  ),
);
