import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const sourceRoot = path.join(repoRoot, "docs", "marksheet-json-by-exam-path");
const outputRoot = path.join(repoRoot, "docs", "marksheet-json-by-exam-path-staging-safe");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function walkFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(entryPath, out);
    else out.push(entryPath);
  }
  return out;
}

function positiveInteger(value, fallback = 1) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.max(1, Math.round(number));
}

function ruleForQuestion(rules, questionId) {
  const matches = rules.filter((rule) => Array.isArray(rule.questionIds) && rule.questionIds.includes(questionId));
  if (!matches.length) return null;
  matches.sort((a, b) => {
    const aLen = a.questionIds.length;
    const bLen = b.questionIds.length;
    return aLen - bLen || Number(b.points ?? 0) - Number(a.points ?? 0);
  });
  return matches[0];
}

function normalizeDisplayPoints(schema) {
  const rules = Array.isArray(schema.scoringRules) ? schema.scoringRules : [];
  const questions = Array.isArray(schema.questions) ? schema.questions : [];
  let changed = 0;

  for (const question of questions) {
    const rule = ruleForQuestion(rules, question.id);
    const nextPoints = rule ? positiveInteger(rule.points) : positiveInteger(question.points);
    if (question.points !== nextPoints) {
      question.points = nextPoints;
      changed += 1;
    }
  }

  return changed;
}

if (!fs.existsSync(sourceRoot)) {
  throw new Error(`Missing source export folder: ${sourceRoot}`);
}

if (fs.existsSync(outputRoot)) {
  fs.rmSync(outputRoot, { recursive: true, force: true });
}
fs.cpSync(sourceRoot, outputRoot, { recursive: true });

const marksheetFiles = walkFiles(outputRoot).filter((filePath) => path.basename(filePath) === "marksheet.json");
const audit = {
  sourceRoot,
  outputRoot,
  files: marksheetFiles.length,
  changedQuestions: 0,
  filesWithFractionalQuestionPoints: [],
  filesWithZeroOrNegativeQuestionPoints: [],
  scoringRuleTotalsChanged: [],
};

for (const filePath of marksheetFiles) {
  const before = readJson(filePath);
  const beforeRuleTotal = (before.scoringRules ?? []).reduce((sum, rule) => sum + Number(rule.points ?? 0), 0);
  const changed = normalizeDisplayPoints(before);
  const afterRuleTotal = (before.scoringRules ?? []).reduce((sum, rule) => sum + Number(rule.points ?? 0), 0);
  audit.changedQuestions += changed;

  const relative = path.relative(outputRoot, filePath).replaceAll(path.sep, "/");
  const points = (before.questions ?? []).map((question) => question.points);
  if (points.some((point) => typeof point === "number" && !Number.isInteger(point))) {
    audit.filesWithFractionalQuestionPoints.push(relative);
  }
  if (points.some((point) => Number(point) <= 0)) {
    audit.filesWithZeroOrNegativeQuestionPoints.push(relative);
  }
  if (beforeRuleTotal !== afterRuleTotal) {
    audit.scoringRuleTotalsChanged.push(relative);
  }

  writeJson(filePath, before);
}

writeJson(path.join(outputRoot, "staging-safe-audit.json"), audit);
console.log(JSON.stringify(audit, null, 2));
