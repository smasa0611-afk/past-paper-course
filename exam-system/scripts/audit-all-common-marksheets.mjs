import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");

const roots = ["common", "common_retake"];
const failOnReview = process.argv.includes("--strict");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function readMetadata(fileInfo, schema) {
  const metadataPath = path.join(path.dirname(fileInfo.marksheetPath), "metadata.json");
  if (fs.existsSync(metadataPath)) return readJson(metadataPath);
  return schema.metadata ?? {};
}

function findMarksheetFiles() {
  const files = [];
  for (const root of roots) {
    const rootDir = path.join(repoRoot, root);
    for (const year of fs.readdirSync(rootDir)) {
      const yearDir = path.join(rootDir, year);
      if (!fs.statSync(yearDir).isDirectory()) continue;
      for (const subject of fs.readdirSync(yearDir)) {
        const subjectDir = path.join(yearDir, subject);
        const marksheetPath = path.join(subjectDir, "marksheet.json");
        if (fs.existsSync(marksheetPath)) files.push({ root, year, subject, examId: `${root}/${year}/${subject}`, marksheetPath });
      }
    }
  }
  return files.sort((a, b) => a.examId.localeCompare(b.examId));
}

function hasAnswerValue(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function matchesVariant(variant, actual, orderMatters = true) {
  if (variant.length !== actual.length) return false;
  if (!orderMatters) {
    const expectedSorted = [...variant].sort();
    const actualSorted = [...actual].sort();
    return expectedSorted.every((expected, index) => expected === "*" || expected === actualSorted[index]);
  }
  return variant.every((expected, index) => expected === "*" || expected === actual[index]);
}

function matchesScoringRule(rule, actual) {
  return (rule.acceptedVariants ?? []).some((variant) => matchesVariant(variant.map(String), actual.map(String), rule.orderMatters !== false));
}

function getAwardedPoints(rule, actual) {
  if (matchesScoringRule(rule, actual)) return Number(rule.points ?? 0);
  const partial = rule.partialCredit?.find((entry) =>
    entry.acceptedVariants.some((variant) => matchesVariant(variant.map(String), actual.map(String), entry.orderMatters ?? (rule.orderMatters !== false))),
  );
  return partial ? Number(partial.points ?? 0) : 0;
}

function buildFallbackScoringRules(schema) {
  return (schema.questions ?? [])
    .filter((question) => hasAnswerValue(question.correctAnswer))
    .map((question) => ({
      id: question.id,
      title: question.prompt,
      questionIds: [question.id],
      acceptedVariants: [[String(question.correctAnswer)]],
      points: question.points ?? 1,
      sectionId: question.sectionId,
    }));
}

function buildEffectiveScoringRules(schema) {
  const explicitRules = schema.scoringRules ?? [];
  if (!explicitRules.length) return buildFallbackScoringRules(schema);
  const covered = new Set(explicitRules.flatMap((rule) => rule.questionIds ?? []));
  return [
    ...explicitRules,
    ...buildFallbackScoringRules(schema).filter((rule) => !rule.questionIds.some((questionId) => covered.has(questionId))),
  ];
}

function combinations(values, size) {
  if (size <= 0) return [[]];
  if (values.length < size) return [];
  if (size === 1) return values.map((value) => [value]);
  const result = [];
  values.forEach((value, index) => {
    for (const rest of combinations(values.slice(index + 1), size - 1)) result.push([value, ...rest]);
  });
  return result;
}

function selectionCases(schema) {
  const groups = schema.selectionGroups ?? [];
  if (!groups.length) return [{ selectedSectionIds: [] }];
  let cases = [{ selectedSectionIds: [] }];
  for (const group of groups) {
    const maxSelect = group.maxSelect ?? group.minSelect ?? group.sectionIds.length;
    const minSelect = group.minSelect ?? maxSelect;
    const groupCases = [];
    for (let size = minSelect; size <= maxSelect; size += 1) {
      groupCases.push(...combinations(group.sectionIds, size));
    }
    cases = cases.flatMap((base) =>
      groupCases.map((choice) => ({ selectedSectionIds: [...base.selectedSectionIds, ...choice] })),
    );
  }
  return cases.length ? cases : [{ selectedSectionIds: [] }];
}

function activeQuestionIds(schema, selectedSectionIds) {
  const selectableSectionIds = new Set(schema.selectionGroups?.flatMap((group) => group.sectionIds) ?? []);
  const selected = new Set(selectedSectionIds);
  return new Set((schema.questions ?? [])
    .filter((question) => !question.sectionId || !selectableSectionIds.has(question.sectionId) || selected.has(question.sectionId))
    .map((question) => question.id));
}

function ruleIsActive(rule, activeIds) {
  return (rule.questionIds ?? []).every((questionId) => activeIds.has(questionId));
}

function answersForRules(rules) {
  const answers = {};
  for (const rule of rules) {
    const variant = rule.acceptedVariants?.[0] ?? [];
    rule.questionIds?.forEach((questionId, index) => {
      answers[questionId] = String(variant[index] ?? "");
    });
  }
  return answers;
}

function gradeRules(rules, answers) {
  return rules.reduce((sum, rule) => {
    const actual = (rule.questionIds ?? []).map((questionId) => String(answers[questionId] ?? ""));
    return sum + getAwardedPoints(rule, actual);
  }, 0);
}

function canonicalCommonMax(subject) {
  if (subject === "japanese") return 200;
  if (["physics_basics", "chemistry_basics", "biology_basics", "earth_science_basics"].includes(subject)) return 50;
  return 100;
}

function questionLabel(schema, questionId) {
  const question = schema.questions?.find((candidate) => candidate.id === questionId);
  return String(question?.displayLabel ?? questionId);
}

function labelList(schema, rule) {
  return (rule.questionIds ?? []).map((questionId) => questionLabel(schema, questionId)).join("-");
}

function mutateOneAnswer(schema, questionId, current) {
  const question = schema.questions?.find((candidate) => candidate.id === questionId);
  const choices = [
    ...(question?.choices ?? []).map((choice) => typeof choice === "string" ? choice : choice.value),
    ...(schema.defaultChoices ?? []).map((choice) => typeof choice === "string" ? choice : choice.value),
    "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
  ].map(String);
  return choices.find((choice) => choice !== String(current)) ?? "__wrong__";
}

function auditSchema(fileInfo) {
  const schema = readJson(fileInfo.marksheetPath);
  const metadata = readMetadata(fileInfo, schema);
  const rules = buildEffectiveScoringRules(schema);
  const issues = [];
  const reviews = [];

  if (metadata.source?.marksheet_status === "not_generated" || metadata.source?.kind === "partial") {
    if (!rules.length) {
      reviews.push("marksheet:notGenerated");
      return { ...fileInfo, questions: schema.questions?.length ?? 0, rules: rules.length, issues, reviews };
    }
  }

  if (!schema.questions?.length) issues.push("questions:empty");
  if (!rules.length) issues.push("rules:empty");

  const covered = new Set(rules.flatMap((rule) => rule.questionIds ?? []));
  const uncovered = (schema.questions ?? []).filter((question) => !covered.has(question.id) && !hasAnswerValue(question.correctAnswer));
  if (uncovered.length) issues.push(`questions:uncovered:${uncovered.slice(0, 8).map((question) => question.displayLabel ?? question.id).join(",")}`);

  for (const selection of selectionCases(schema)) {
    const activeIds = activeQuestionIds(schema, selection.selectedSectionIds);
    const activeRules = rules.filter((rule) => ruleIsActive(rule, activeIds));
    const answers = answersForRules(activeRules);
    const score = gradeRules(activeRules, answers);
    const expected = canonicalCommonMax(fileInfo.subject);
    if (score !== expected) issues.push(`max:${selection.selectedSectionIds.join("+") || "all"}:${score}/${expected}`);
  }

  for (const rule of rules) {
    const label = labelList(schema, rule);
    if (!rule.acceptedVariants?.length) {
      issues.push(`rule:${label}:noAcceptedVariants`);
      continue;
    }
    for (const variant of rule.acceptedVariants) {
      const score = getAwardedPoints(rule, variant.map(String));
      if (score !== Number(rule.points ?? 0)) issues.push(`rule:${label}:acceptedVariantScores${score}of${rule.points}`);
    }
    if ((rule.questionIds ?? []).length > 1) {
      const firstVariant = rule.acceptedVariants[0].map(String);
      const full = getAwardedPoints(rule, firstVariant);
      if (full !== Number(rule.points ?? 0)) issues.push(`composite:${label}:correctComboNotFull`);
      const changed = [...firstVariant];
      changed[0] = mutateOneAnswer(schema, rule.questionIds[0], changed[0]);
      const changedScore = getAwardedPoints(rule, changed);
      if (changedScore > 0 && !rule.partialCredit?.length) reviews.push(`composite:${label}:wrongComboGets${changedScore}NoPartialRule`);
    }
    if ((rule.questionIds ?? []).length > 1 && rule.orderMatters === false) {
      const reversed = [...rule.acceptedVariants[0]].reverse().map(String);
      const score = getAwardedPoints(rule, reversed);
      if (score !== Number(rule.points ?? 0)) issues.push(`unordered:${label}:reverseScores${score}of${rule.points}`);
    }
    for (const partial of rule.partialCredit ?? []) {
      for (const variant of partial.acceptedVariants ?? []) {
        const score = getAwardedPoints(rule, variant.map(String));
        if (score !== Number(partial.points ?? 0)) issues.push(`partial:${label}:variantScores${score}of${partial.points}`);
      }
    }
  }

  for (const question of schema.questions ?? []) {
    const choices = [
      ...(question.choices ?? []).map((choice) => typeof choice === "string" ? choice : choice.value),
      ...(schema.defaultChoices ?? []).map((choice) => typeof choice === "string" ? choice : choice.value),
    ].map(String);
    const expectedAnswers = rules
      .filter((rule) => (rule.questionIds ?? []).includes(question.id))
      .flatMap((rule) => [
        ...(rule.acceptedVariants ?? []).flatMap((variant) => variant[(rule.questionIds ?? []).indexOf(question.id)] ?? []),
        ...(rule.partialCredit ?? []).flatMap((partial) =>
          (partial.acceptedVariants ?? []).flatMap((variant) => variant[(rule.questionIds ?? []).indexOf(question.id)] ?? []),
        ),
      ])
      .filter((answer) => answer != null && answer !== "*")
      .map(String);
    if (choices.length && expectedAnswers.some((answer) => !choices.includes(answer))) {
      issues.push(`choices:${question.displayLabel ?? question.id}:missing:${[...new Set(expectedAnswers.filter((answer) => !choices.includes(answer)))].join(",")}`);
    }
  }

  return { ...fileInfo, questions: schema.questions?.length ?? 0, rules: rules.length, issues, reviews };
}

const results = findMarksheetFiles().map(auditSchema);
const failing = results.filter((result) => result.issues.length);
const review = results.filter((result) => result.reviews.length);

for (const result of results) {
  if (!result.issues.length && !result.reviews.length) continue;
  console.log(`${result.issues.length ? "NG" : "REVIEW"} ${result.examId} q=${result.questions} rules=${result.rules}`);
  for (const issue of result.issues) console.log(`  - ${issue}`);
  for (const item of result.reviews) console.log(`  - ${item}`);
}

console.log(JSON.stringify({
  checked: results.length,
  failed: failing.length,
  review: review.length,
}, null, 2));

if (failing.length || (failOnReview && review.length)) process.exit(1);
