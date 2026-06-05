import fs from "node:fs";
import path from "node:path";

const projectDir = path.resolve(import.meta.dirname, "..");
const rootDir = projectDir;
const publicRoot = path.join(projectDir, "public", "exam-assets");
const generatedRoot = path.join(projectDir, "src", "generated");
const examIndexPath = path.join(generatedRoot, "exams-index.json");
const sourceRoots = ["common", "common_retake", "todai", "kyodai", "nagoya", "hamamatsu_medical", "secondary"];
const copiedExtensions = new Set([".pdf", ".json", ".md"]);
const hiddenExamIds = new Set([
  "common/2024/information_related_basics",
  "common_retake/2023/information_related_basics",
  "common_retake/2023/math_ia",
  "common_retake/2023/math_iib",
  "common_retake/2024/information_related_basics",
  "common_retake/2024/math_ia",
  "common_retake/2024/math_iib",
]);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function normalizeRelativePath(relativePath) {
  return relativePath.replace(/\\/g, "/");
}

function isHiddenExamPath(relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  return [...hiddenExamIds].some((hiddenId) => normalized === hiddenId || normalized.startsWith(`${hiddenId}/`));
}

function copyAssetTree(sourceDir, relativeBase = "") {
  if (!fs.existsSync(sourceDir)) return 0;

  if (relativeBase && isHiddenExamPath(relativeBase)) {
    return 0;
  }

  let copied = 0;
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const relativePath = path.join(relativeBase, entry.name);

    if (entry.isDirectory()) {
      copied += copyAssetTree(sourcePath, relativePath);
      continue;
    }

    if (!entry.isFile() || !copiedExtensions.has(path.extname(entry.name).toLowerCase())) {
      continue;
    }

    const destinationPath = path.join(publicRoot, relativePath);
    ensureDir(path.dirname(destinationPath));

    const sourceStat = fs.statSync(sourcePath);
    let shouldCopy = true;
    if (fs.existsSync(destinationPath)) {
      const destinationStat = fs.statSync(destinationPath);
      shouldCopy =
        destinationStat.size !== sourceStat.size ||
        Math.trunc(destinationStat.mtimeMs) < Math.trunc(sourceStat.mtimeMs);
    }

    if (shouldCopy) {
      fs.copyFileSync(sourcePath, destinationPath);
    }
    copied += 1;
  }

  return copied;
}

function findExams(dir, rootDataDir, examList = []) {
  if (!fs.existsSync(dir)) return examList;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") continue;

    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findExams(entryPath, rootDataDir, examList);
      continue;
    }

    if (!entry.isFile() || entry.name !== "metadata.json") continue;

    try {
      const examDir = path.dirname(entryPath);
      const metadata = JSON.parse(fs.readFileSync(entryPath, "utf8"));
      const problemPath = metadata.problem_files?.[0]?.path ?? "problem.pdf";
      if (!fs.existsSync(path.join(examDir, problemPath))) continue;
      const relativePath = path.relative(rootDataDir, examDir).replace(/\\/g, "/");
      if (isHiddenExamPath(relativePath)) continue;
      examList.push({
        id: relativePath,
        ...metadata,
        hasMarksheet: fs.existsSync(path.join(examDir, "marksheet.json")),
        hasAnswer:
          Boolean(metadata.answer_files?.some((file) => fs.existsSync(path.join(examDir, file.path)))) ||
          fs.existsSync(path.join(examDir, "answer.pdf")),
      });
    } catch (error) {
      console.warn(`Failed to read exam metadata at ${entryPath}:`, error);
    }
  }

  return examList;
}

ensureDir(publicRoot);
ensureDir(generatedRoot);
fs.rmSync(publicRoot, { recursive: true, force: true });
ensureDir(publicRoot);

let assetTotal = 0;
const exams = [];
for (const root of sourceRoots) {
  const sourceRoot = path.join(rootDir, root);
  assetTotal += copyAssetTree(sourceRoot, root);
  findExams(sourceRoot, rootDir, exams);
}

exams.sort((a, b) => String(b.year ?? "").localeCompare(String(a.year ?? "")) || a.id.localeCompare(b.id));
fs.writeFileSync(examIndexPath, `${JSON.stringify(exams, null, 2)}\n`);

console.log(`Synced ${assetTotal} exam assets to public/exam-assets.`);
console.log(`Generated ${exams.length} exam index entries.`);
