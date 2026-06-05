import fs from "fs";
import https from "https";
import path from "path";
import { fileURLToPath } from "url";
import XLSX from "xlsx";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..", "..");
const sourceDir = path.join(workspaceRoot, "data", "universities", "source");
const outputPath = path.join(workspaceRoot, "data", "universities", "2026_mext_universities.json");

const sourceFiles = [
  ["national", "国立", "20250625-mxt_daigakuc01-000043215_01.xlsx"],
  ["public", "公立", "20250625-mxt_daigakuc01-000043215_02.xlsx"],
  ["private-1", "私立", "20250625-mxt_daigakuc01-000043215_03-1.xlsx"],
  ["private-2", "私立", "20250625-mxt_daigakuc01-000043215_03-2.xlsx"],
  ["private-3", "私立", "20250625-mxt_daigakuc01-000043215_03-3.xlsx"],
  ["private-4", "私立", "20250625-mxt_daigakuc01-000043215_03-4.xlsx"],
  ["private-5", "私立", "20250625-mxt_daigakuc01-000043215_03-5.xlsx"],
  ["private-6", "私立", "20250625-mxt_daigakuc01-000043215_03-6.xlsx"],
  ["private-7", "私立", "20250625-mxt_daigakuc01-000043215_03-7.xlsx"],
  ["private-8", "私立", "20250625-mxt_daigakuc01-000043215_03-8.xlsx"],
  ["open-university", "私立", "20250625-mxt_daigakuc01-000043215_05.xlsx"],
];

function download(url, destination) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destination);
    https
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          file.close();
          fs.rmSync(destination, { force: true });
          reject(new Error(`Download failed: ${response.statusCode} ${url}`));
          return;
        }

        response.pipe(file);
        file.on("finish", () => {
          file.close(resolve);
        });
      })
      .on("error", (error) => {
        file.close();
        fs.rmSync(destination, { force: true });
        reject(error);
      });
  });
}

async function ensureSourceFiles() {
  fs.mkdirSync(sourceDir, { recursive: true });
  for (const [, , fileName] of sourceFiles) {
    const destination = path.join(sourceDir, fileName);
    if (fs.existsSync(destination) && fs.statSync(destination).size > 0) continue;
    await download(`https://www.mext.go.jp/content/${fileName}`, destination);
  }
}

function clean(value) {
  return String(value ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toNumber(value) {
  const cleaned = clean(value).replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseUniversityName(title, fallbackName, fallbackType) {
  const cleanTitle = clean(title);
  const matched = cleanTitle.match(/^(国立|公立|私立)\s+(.+?)（/);
  if (matched) return { installationType: matched[1], university: matched[2] };
  return { installationType: fallbackType, university: fallbackName };
}

function findUndergraduateHeader(rows) {
  return rows.findIndex((row) => clean(row[1]) === "学部" && clean(row[3]) === "学科" && clean(row[10]) === "修業年限");
}

function parseWorkbook(filePath, sourceKind, fallbackType) {
  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const records = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, blankrows: true, defval: "" });
    const { installationType, university } = parseUniversityName(rows[0]?.[1], sheetName, fallbackType);
    const schoolCodeHeaderIndex = rows.findIndex((row) => clean(row[1]) === "学校コード");
    const schoolInfoRow = schoolCodeHeaderIndex >= 0 ? rows[schoolCodeHeaderIndex + 1] : [];
    const universityCode = clean(schoolInfoRow?.[1]);
    const postalCode = clean(schoolInfoRow?.[9]);
    const address = clean(schoolInfoRow?.[11]);
    const phone = clean(schoolInfoRow?.[18]);
    const headerIndex = findUndergraduateHeader(rows);
    if (headerIndex < 0 || !universityCode || !university) continue;

    let emptyRows = 0;
    for (let index = headerIndex + 2; index < rows.length; index += 1) {
      const row = rows[index];
      const faculty = clean(row[1]);
      const department = clean(row[3]);
      if (!faculty && !department) {
        emptyRows += 1;
        if (emptyRows > 12) break;
        continue;
      }
      emptyRows = 0;

      if (faculty.includes("共同実施制度") || faculty.includes("専攻科") || faculty.includes("別科") || faculty.includes("大学院")) break;
      if (!faculty || !department || faculty === "学部" || department === "学科") continue;

      records.push({
        id: `${universityCode}-${records.length + 1}`,
        sourceYear: 2026,
        source: "文部科学省 令和6年度全国大学一覧",
        sourceKind,
        installationType,
        universityCode,
        university,
        faculty,
        department,
        prefecture: clean(row[6]),
        city: clean(row[8]),
        durationYears: toNumber(row[10]),
        admissionCapacity: toNumber(row[13] || row[11]),
        postalCode,
        address,
        phone,
        searchText: [universityCode, university, faculty, department, clean(row[6]), clean(row[8])].filter(Boolean).join(" "),
      });
    }
  }

  return records;
}

await ensureSourceFiles();

const allRecords = [];
for (const [sourceKind, fallbackType, fileName] of sourceFiles) {
  allRecords.push(...parseWorkbook(path.join(sourceDir, fileName), sourceKind, fallbackType));
}

const uniqueRecords = Array.from(
  new Map(
    allRecords.map((record) => [
      [record.universityCode, record.university, record.faculty, record.department, record.prefecture, record.city].join("\u0000"),
      record,
    ]),
  ).values(),
).sort((a, b) =>
  a.university.localeCompare(b.university, "ja") ||
  a.faculty.localeCompare(b.faculty, "ja") ||
  a.department.localeCompare(b.department, "ja"),
);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(uniqueRecords, null, 2)}\n`);

const universities = new Set(uniqueRecords.map((record) => record.university));
console.log(`Imported ${uniqueRecords.length} departments from ${universities.size} universities.`);
console.log(path.relative(workspaceRoot, outputPath));
