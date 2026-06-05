import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import XLSX from "xlsx";

const outputPath = process.argv[2] ?? path.resolve(process.cwd(), "..", "data", "video-lessons.json");
const desktop = path.join(os.homedir(), "Desktop");

function findDesktopWorkbook(predicate) {
  const files = fs.readdirSync(desktop).filter((file) => file.endsWith(".xlsx"));
  const found = files.find(predicate);
  if (!found) throw new Error("Required workbook was not found on Desktop.");
  return path.join(desktop, found);
}

const urlWorkbookPath = findDesktopWorkbook((file) => file.includes("映像データ"));
const listWorkbookPath = findDesktopWorkbook((file) => file.includes("動画リスト_2026.0509"));

function text(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalize(value) {
  return text(value)
    .replace(/[‐－–—]/g, "-")
    .replace(/[（）]/g, (match) => (match === "（" ? "(" : ")"))
    .replace(/\s+/g, "")
    .toLowerCase();
}

function extractTeacher(rawCourse) {
  const [base, teacherPart = ""] = text(rawCourse).split("／");
  return {
    courseName: base.trim(),
    teacher: teacherPart.replace(/先生/g, "").trim(),
  };
}

function parseNumberPrefix(value) {
  const raw = text(value);
  const match = raw.match(/^(\d+)\s*(.*)$/);
  return {
    number: match ? Number(match[1]) : null,
    title: match ? match[2].trim() : raw,
  };
}

function fcdFromUrl(rawUrl) {
  try {
    return new URL(rawUrl).searchParams.get("fcd") ?? "";
  } catch {
    return "";
  }
}

function targetFromGroup(group) {
  if (group.includes("東大")) return { subject: "secondary", skill: "secondary_todai", examType: "todai" };
  if (group.includes("京大")) return { subject: "secondary", skill: "secondary_kyodai", examType: "kyodai" };
  if (group.includes("名大")) return { subject: "secondary", skill: "secondary_nagoya", examType: "nagoya" };
  if (group.includes("浜松医科大")) return { subject: "secondary", skill: "secondary_hamamatsu_medical", examType: "hamamatsu_medical" };
  return null;
}

function commonSkill(courseName, subjectName, teacher) {
  const source = `${courseName} ${subjectName} ${teacher}`;
  if (source.includes("リスニング")) return "listening";
  if (subjectName.includes("英語") || source.includes("リーディング")) return "reading";
  if (source.includes("数学ⅠＡ") || source.includes("数学IA") || source.includes("数学I A")) return "math_ia";
  if (source.includes("数学ⅡＢＣ") || source.includes("数学IIBC") || source.includes("数学II BC") || source.includes("数学ⅡＢ")) return "math_iibc";
  if (source.includes("現代文")) {
    if (teacher.includes("菊間")) return "japanese_modern_kikuma";
    if (teacher.includes("柴田")) return "japanese_modern_shibata";
    return "japanese_modern_takeuchi";
  }
  if (source.includes("漢文")) return "japanese_kanbun_sekijima";
  if (source.includes("古文")) return teacher.includes("和田") ? "japanese_classical_wada" : "japanese_classical_sekijima";
  if (source.includes("世界史新傾向")) return "world_history_new_trends";
  if (source.includes("世界史")) return "world_history";
  if (source.includes("日本史")) return "japanese_history";
  if (source.includes("地理 実戦") || source.includes("地理実戦")) return "geography_practice";
  if (source.includes("地理")) return "geography";
  if (source.includes("物理基礎")) return "physics_basic";
  if (source.includes("物理")) return "physics";
  if (source.includes("化学基礎")) return "chemistry_basic";
  if (source.includes("化学")) return "chemistry";
  if (source.includes("生物基礎")) return "biology_basic";
  if (source.includes("生物")) return "biology";
  if (source.includes("地学基礎")) return "earth_science_basic";
  if (source.includes("情報")) return "information_i";
  if (source.includes("政治・経済")) return "politics_economics";
  if (source.includes("公共")) return "public_civics";
  if (source.includes("倫理")) return "ethics";
  return "reading";
}

function readCourseList() {
  const workbook = XLSX.readFile(listWorkbookPath);
  const records = [];
  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "" });
    let group = sheetName.trim();
    for (const row of rows) {
      const marker = text(row[1]);
      if (/^【.+】$/.test(marker)) group = marker.replace(/[【】]/g, "");
      const courseName = sheetName.includes("共通") ? text(row[1]) : text(row[2]);
      const teacher = sheetName.includes("共通") ? text(row[2]) : text(row[3]);
      if (!courseName || courseName === "講座名") continue;
      records.push({ group, courseName, teacher, key: normalize(`${courseName}${teacher}`) });
    }
  }
  return records;
}

function buildLessons() {
  const courseList = readCourseList();
  const listedKeys = new Set(courseList.map((item) => item.key));
  const workbook = XLSX.readFile(urlWorkbookPath);
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: "" });
  const lessons = [];
  const stats = { listedCourseMatches: 0, listedCourseMisses: new Set(), urlCourses: new Set() };
  let group = "";
  let sequence = 1;
  const courseLessonCounts = new Map();

  for (const row of rows) {
    const first = text(row[0]);
    const rawCourse = text(row[1]);
    const unitName = text(row[2]);
    const rawLessonName = text(row[3]);
    const videoUrl = text(row[4]);

    if (first && !rawCourse && !unitName && !rawLessonName && !videoUrl) {
      group = first;
      continue;
    }
    if (!videoUrl.startsWith("http")) continue;

    const { courseName, teacher } = extractTeacher(rawCourse);
    const target = targetFromGroup(group);
    const skill = target?.skill ?? commonSkill(courseName, first, teacher);
    const subject = target?.subject ?? (first || "common");
    const unit = parseNumberPrefix(unitName);
    const lessonName = parseNumberPrefix(rawLessonName);
    const fcd = fcdFromUrl(videoUrl);
    const courseKey = normalize(`${courseName}${teacher}`);
    const lessonIndex = (courseLessonCounts.get(courseKey) ?? 0) + 1;
    courseLessonCounts.set(courseKey, lessonIndex);
    stats.urlCourses.add(courseKey);
    if (listedKeys.has(courseKey)) stats.listedCourseMatches += 1;
    else stats.listedCourseMisses.add(`${group} / ${courseName} / ${teacher}`);

    lessons.push({
      id: fcd ? `v-${fcd.toLowerCase()}` : `v-${String(sequence).padStart(5, "0")}`,
      subject,
      skill,
      ...(target?.examType ? { examType: target.examType } : {}),
      courseName,
      teacher,
      chapter: unitName,
      sectionNo: unit.number === null ? "" : String(unit.number),
      sectionTitle: unit.title,
      lessonNo: lessonName.number ?? lessonIndex,
      title: lessonName.title || rawLessonName,
      duration: "映像",
      sequence,
      provider: "iframe",
      videoUrl,
    });
    sequence += 1;
  }

  return { lessons, stats, courseList };
}

const { lessons, stats, courseList } = buildLessons();
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(lessons, null, 2)}\n`, "utf-8");

console.log(`Imported ${lessons.length} video lessons to ${outputPath}`);
console.log(`Course-list rows: ${courseList.length}`);
console.log(`URL courses: ${stats.urlCourses.size}`);
console.log(`URL course names not exactly listed: ${stats.listedCourseMisses.size}`);
if (stats.listedCourseMisses.size) {
  console.log([...stats.listedCourseMisses].slice(0, 20).join("\n"));
}
