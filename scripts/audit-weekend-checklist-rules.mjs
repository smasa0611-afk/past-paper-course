import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EXPLICIT_MARKSHEET_RULES, R_COLUMN_ITEMS } from "./weekend-checklist-rules.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");

function readSchema(examId) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, examId, "marksheet.json"), "utf8"));
}

function labelsOf(schema, rule) {
  return (rule.questionIds ?? []).map((questionId) => {
    const question = schema.questions?.find((candidate) => candidate.id === questionId);
    return String(question?.displayLabel ?? questionId);
  });
}

function findRule(schema, labels) {
  const key = labels.join("|");
  return (schema.scoringRules ?? []).find((rule) => labelsOf(schema, rule).join("|") === key);
}

function checkOperation(schema, operation) {
  if (operation.type === "total") {
    return schema.totalPoints === operation.total && schema.metadata?.expectedMax === operation.total;
  }
  if (operation.type === "clearSelectionGroups") return (schema.selectionGroups ?? []).length === 0;
  if (operation.type === "addZeroChoice") {
    return (schema.questions ?? []).every((question) => (question.choices ?? []).map(String).includes("0"));
  }
  if (operation.type === "single") {
    const rule = findRule(schema, [operation.label]);
    if (!rule) return false;
    if (operation.points != null && Number(rule.points) !== Number(operation.points)) return false;
    if (operation.answer != null && !rule.acceptedVariants?.some((variant) => variant.length === 1 && variant[0] === String(operation.answer))) return false;
    if (operation.acceptedVariants) {
      const actual = new Set((rule.acceptedVariants ?? []).map((variant) => variant.join("|")));
      return operation.acceptedVariants.every((variant) => actual.has(variant.join("|")));
    }
    return true;
  }
  if (operation.type === "composite") {
    const rule = findRule(schema, operation.labels);
    if (!rule) return false;
    if (operation.points != null && Number(rule.points) !== Number(operation.points)) return false;
    if (operation.orderMatters === false && rule.orderMatters !== false) return false;
    if (operation.orderMatters !== false && rule.orderMatters === false) return false;
    if (operation.partialPoints && !Array.isArray(rule.partialCredit)) return false;
    if (operation.acceptedVariants) {
      const actual = new Set((rule.acceptedVariants ?? []).map((variant) => variant.join("|")));
      if (!operation.acceptedVariants.every((variant) => actual.has(variant.join("|")))) return false;
    }
    return true;
  }
  if (operation.type === "rebuildIntegratedHistoryPublic2025Retake") {
    const sections = new Set((schema.questions ?? []).map((question) => question.sectionId));
    return schema.questions?.length === 48 && schema.scoringRules?.length === 48
      && sections.has("geography_integrated") && sections.has("history_integrated") && sections.has("public")
      && (schema.selectionGroups ?? []).some((group) => group.maxSelect === 2);
  }
  if (operation.type === "rebuildPhysicsBasics2022Retake") {
    return schema.questions?.length === 18
      && findRule(schema, ["13", "14"])?.orderMatters === false
      && findRule(schema, ["15", "16"])?.partialCredit?.length === 2
      && findRule(schema, ["17", "18"])?.partialCredit?.length === 2
      && schema.totalPoints === 50;
  }
  return false;
}

let failed = 0;
const explicitByNo = new Map(EXPLICIT_MARKSHEET_RULES.map((rule) => [rule.no, rule]));

console.log(`R column items: ${R_COLUMN_ITEMS.length}`);
for (const item of R_COLUMN_ITEMS) {
  const explicit = explicitByNo.get(item.no);
  if (!explicit) {
    console.log(`REVIEW no=${item.no} ${item.examId} - ${item.issue}`);
    continue;
  }
  const schema = readSchema(explicit.examId);
  for (const operation of explicit.operations) {
    const ok = checkOperation(schema, operation);
    console.log(`${ok ? "OK" : "NG"} no=${item.no} ${explicit.examId} ${operation.type}${operation.labels ? ` ${operation.labels.join("-")}` : ""}${operation.label ? ` ${operation.label}` : ""}`);
    if (!ok) failed += 1;
  }
}

if (failed > 0) {
  console.error(`Weekend checklist audit failed: ${failed}`);
  process.exit(1);
}
