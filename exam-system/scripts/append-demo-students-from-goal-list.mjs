import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const workspaceRoot = path.resolve(process.cwd(), "..");
const studentsPath = path.join(workspaceRoot, "data", "students.json");
const sourceWorkbookPath = path.join("C:\\Users\\smasa\\Desktop", "志望校リスト.xlsx");
const defaultPassword = "pass1234";

const workbook = XLSX.readFile(sourceWorkbookPath);
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
const students = JSON.parse(fs.readFileSync(studentsPath, "utf8"));
const existingIds = new Set(students.map((student) => String(student.id)));

const toCellString = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(Math.trunc(value));
  return String(value).replace(/\.0$/, "").trim();
};

const added = [];

for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
  const row = rows[rowIndex] ?? [];
  const studentId = toCellString(row[3]);
  const name = toCellString(row[4]);
  const target = toCellString(row[5]);
  const campus = toCellString(row[1]);
  const grade = toCellString(row[2]);

  if (!studentId || !name) continue;
  if (existingIds.has(studentId)) continue;

  const student = {
    id: studentId,
    name,
    password: defaultPassword,
    target,
    campus,
    grade,
  };

  students.push(student);
  existingIds.add(studentId);
  added.push(student);
}

fs.writeFileSync(studentsPath, JSON.stringify(students, null, 2), "utf8");

console.log(
  JSON.stringify(
    {
      addedCount: added.length,
      totalCount: students.length,
      defaultPassword,
      sampleAdded: added.slice(0, 10),
    },
    null,
    2,
  ),
);
