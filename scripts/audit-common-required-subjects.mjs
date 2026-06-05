import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const rootDir = path.resolve(import.meta.dirname, "..");
const commonRoot = path.join(rootDir, "common");

const requiredByYear = {
  2022: [
    "japanese",
    "world_history_b",
    "japanese_history_b",
    "geography_b",
    "modern_society",
    "ethics",
    "politics_economy",
    "ethics_politics_economy",
    "english",
    "english_listening",
    "math_ia",
    "math_iib",
    "physics_basics",
    "chemistry_basics",
    "biology_basics",
    "earth_science_basics",
    "physics",
    "chemistry",
    "biology",
    "earth_science",
  ],
  2023: [
    "japanese",
    "world_history_b",
    "japanese_history_b",
    "geography_b",
    "modern_society",
    "ethics",
    "politics_economy",
    "ethics_politics_economy",
    "english",
    "english_listening",
    "math_ia",
    "math_iib",
    "physics_basics",
    "chemistry_basics",
    "biology_basics",
    "earth_science_basics",
    "physics",
    "chemistry",
    "biology",
    "earth_science",
  ],
  2024: [
    "japanese",
    "world_history_b",
    "japanese_history_b",
    "geography_b",
    "modern_society",
    "ethics",
    "politics_economy",
    "ethics_politics_economy",
    "english",
    "english_listening",
    "math_ia",
    "math_iib",
    "physics_basics",
    "chemistry_basics",
    "biology_basics",
    "earth_science_basics",
    "physics",
    "chemistry",
    "biology",
    "earth_science",
  ],
  2025: [
    "japanese",
    "geography",
    "japanese_history",
    "world_history",
    "public_ethics",
    "public_politics_economy",
    "integrated_history_public",
    "english",
    "english_listening",
    "math_ia",
    "math_iibc",
    "science_basics",
    "physics",
    "chemistry",
    "biology",
    "earth_science",
    "information_i",
  ],
  2026: [
    "japanese",
    "geography",
    "japanese_history",
    "world_history",
    "public_ethics",
    "public_politics_economy",
    "integrated_history_public",
    "english",
    "english_listening",
    "math_ia",
    "math_iibc",
    "science_basics",
    "physics",
    "chemistry",
    "biology",
    "earth_science",
    "information_i",
  ],
};

const intentionallyIgnored = new Set([
  "world_history_a",
  "japanese_history_a",
  "geography_a",
  "math_i",
  "math_ii",
  "german",
  "french",
  "chinese",
  "korean",
  "bookkeeping_accounting",
  "information_related_basics",
]);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function fileStatus(file) {
  if (!fs.existsSync(file)) return { exists: false };
  const stat = fs.statSync(file);
  return { exists: true, bytes: stat.size, sha256: sha256(file) };
}

function listDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

function validateMarksheet(file) {
  const errors = [];
  const warnings = [];
  if (!fs.existsSync(file)) return { errors: ["missing marksheet.json"], warnings };

  let marksheet;
  try {
    marksheet = readJson(file);
  } catch (error) {
    return { errors: [`invalid marksheet.json: ${error.message}`], warnings };
  }

  if (!Array.isArray(marksheet.questions) || marksheet.questions.length === 0) {
    errors.push("marksheet has no questions");
  }

  const ids = new Set();
  for (const question of marksheet.questions ?? []) {
    if (!question.id) errors.push("question without id");
    if (ids.has(question.id)) errors.push(`duplicate question id: ${question.id}`);
    ids.add(question.id);
    const choices = question.choices ?? marksheet.defaultChoices;
    if (!Array.isArray(choices) || choices.length === 0) {
      errors.push(`question ${question.id ?? "unknown"} has no choices`);
    }
  }

  const labels = (marksheet.questions ?? []).map((question) => String(question.displayLabel ?? question.number ?? ""));
  const numericLabels = labels.filter((label) => /^\d+$/.test(label)).map(Number);
  if (numericLabels.length === labels.length && numericLabels.length > 1) {
    for (let index = 1; index < numericLabels.length; index += 1) {
      if (numericLabels[index] < numericLabels[index - 1]) {
        warnings.push("numeric labels are not ascending");
        break;
      }
    }
  }

  return {
    questionCount: marksheet.questions?.length ?? 0,
    scoringRuleCount: marksheet.scoringRules?.length ?? 0,
    errors,
    warnings,
  };
}

const report = {
  generatedAt: new Date().toISOString(),
  requiredByYear,
  years: {},
};

for (const [year, requiredSubjects] of Object.entries(requiredByYear)) {
  const yearDir = path.join(commonRoot, String(year));
  const localSubjects = listDirs(yearDir);
  const requiredSet = new Set(requiredSubjects);
  const extras = localSubjects.filter((subject) => !requiredSet.has(subject));
  const unexpectedExtras = extras.filter((subject) => !intentionallyIgnored.has(subject));

  const subjects = {};
  for (const subject of requiredSubjects) {
    const subjectDir = path.join(yearDir, subject);
    const metadataPath = path.join(subjectDir, "metadata.json");
    const files = {
      problem: fileStatus(path.join(subjectDir, "problem.pdf")),
      answer: fileStatus(path.join(subjectDir, "answer.pdf")),
      metadata: fileStatus(metadataPath),
      marksheet: fileStatus(path.join(subjectDir, "marksheet.json")),
    };
    const metadata = fs.existsSync(metadataPath) ? readJson(metadataPath) : null;
    const marksheet = validateMarksheet(path.join(subjectDir, "marksheet.json"));
    const errors = [];
    if (!fs.existsSync(subjectDir)) errors.push("subject directory missing");
    for (const [key, status] of Object.entries(files)) {
      if (!status.exists) errors.push(`${key} missing`);
      if (status.exists && status.bytes === 0) errors.push(`${key} is empty`);
    }
    if (metadata && metadata.year !== Number(year)) errors.push(`metadata.year is ${metadata.year}`);
    if (metadata && metadata.subject !== subject) errors.push(`metadata.subject is ${metadata.subject}`);
    errors.push(...marksheet.errors);

    subjects[subject] = {
      metadataTitle: metadata?.title ?? null,
      files,
      marksheet,
      errors,
      warnings: marksheet.warnings,
    };
  }

  report.years[year] = {
    requiredCount: requiredSubjects.length,
    localSubjects,
    missingSubjects: requiredSubjects.filter((subject) => !localSubjects.includes(subject)),
    ignoredExtras: extras.filter((subject) => intentionallyIgnored.has(subject)),
    unexpectedExtras,
    subjects,
  };
}

console.log(JSON.stringify(report, null, 2));
