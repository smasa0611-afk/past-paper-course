import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EXPLICIT_MARKSHEET_RULES } from "./weekend-checklist-rules.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");
const repoRoot = appRoot;
const publicRoot = path.join(appRoot, "public", "exam-assets");

const dataRootFor = (examId) => path.join(repoRoot, examId, "marksheet.json");
const publicRootFor = (examId) => path.join(publicRoot, examId, "marksheet.json");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, data) {
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function updateExam(examId, mutator) {
  for (const file of [dataRootFor(examId), publicRootFor(examId)]) {
    if (!fs.existsSync(file)) continue;
    const schema = readJson(file);
    mutator(schema);
    writeJson(file, schema);
  }
}

function uniqueVariants(variants) {
  return Array.from(new Map(variants.map((variant) => [variant.join("\0"), variant])).values());
}

function permutations(values) {
  if (values.length <= 1) return [values];
  const result = [];
  values.forEach((value, index) => {
    const rest = [...values.slice(0, index), ...values.slice(index + 1)];
    for (const variant of permutations(rest)) result.push([value, ...variant]);
  });
  return uniqueVariants(result);
}

function findQuestion(schema, label) {
  return (schema.questions ?? []).find((question) => String(question.displayLabel) === String(label));
}

function findQuestions(schema, labels) {
  return labels.map((label) => {
    const question = findQuestion(schema, label);
    if (!question) throw new Error(`Question label ${label} not found`);
    return question;
  });
}

function removeRulesForQuestionIds(schema, questionIds) {
  const ids = new Set(questionIds);
  schema.scoringRules = (schema.scoringRules ?? []).filter(
    (rule) => !(rule.questionIds ?? []).some((questionId) => ids.has(questionId)),
  );
}

function sortRules(schema) {
  const order = new Map((schema.questions ?? []).map((question, index) => [question.id, index]));
  schema.scoringRules = (schema.scoringRules ?? []).sort((a, b) => {
    const left = order.get(a.questionIds?.[0]) ?? 9999;
    const right = order.get(b.questionIds?.[0]) ?? 9999;
    return left - right;
  });
}

function setCompositeByLabels(schema, labels, options = {}) {
  const questions = findQuestions(schema, labels);
  const questionIds = questions.map((question) => question.id);
  const previousRule = (schema.scoringRules ?? []).find((rule) => {
    const ids = rule.questionIds ?? [];
    return ids.length === questionIds.length && ids.every((questionId, index) => questionId === questionIds[index]);
  });
  const previousAnswers = previousRule?.acceptedVariants?.[0] ?? [];
  const answers = questions.map((question, index) => {
    const answer = options.answers?.[question.displayLabel] ?? question.correctAnswer ?? previousAnswers[index];
    if (answer == null) throw new Error(`Answer for label ${question.displayLabel} not found`);
    return String(answer);
  });
  const previousPoints = (schema.scoringRules ?? [])
    .filter((rule) => (rule.questionIds ?? []).some((questionId) => questionIds.includes(questionId)))
    .reduce((sum, rule) => sum + Number(rule.points ?? 0), 0);
  const points = options.points ?? previousPoints;
  questions.forEach((question, index) => {
    question.correctAnswer = answers[index];
    if (options.pointsPerQuestion) question.points = options.pointsPerQuestion[index] ?? question.points;
  });
  removeRulesForQuestionIds(schema, questionIds);
  const unordered = options.orderMatters === false;
  const rule = {
    id: options.id ?? `rule_${labels.join("_")}`,
    title: options.title ?? `Answer ${labels.join("-")}`,
    questionIds,
    acceptedVariants: options.acceptedVariants ?? (unordered ? permutations(answers) : [answers]),
    points,
    ...(questions[0]?.sectionId ? { sectionId: questions[0].sectionId } : {}),
    ...(questions[0]?.sectionTitle ? { sectionTitle: questions[0].sectionTitle } : {}),
    ...(unordered ? { orderMatters: false } : {}),
  };
  if (options.partialPoints) {
    rule.partialCredit = questions.map((question, index) => ({
      acceptedVariants: [[String(question.correctAnswer)]],
      points: options.partialPoints[index] ?? options.partialPoints[0],
    }));
  }
  if (options.partialCredit) {
    rule.partialCredit = options.partialCredit;
  }
  schema.scoringRules ??= [];
  schema.scoringRules.push(rule);
  sortRules(schema);
}

function setSingleByLabel(schema, label, options = {}) {
  const question = findQuestion(schema, label);
  if (!question) throw new Error(`Question label ${label} not found`);
  const answer = String(options.answer ?? question.correctAnswer);
  question.correctAnswer = answer;
  if (options.choices) question.choices = options.choices.map(String);
  if (options.points) question.points = options.points;
  removeRulesForQuestionIds(schema, [question.id]);
  schema.scoringRules ??= [];
  schema.scoringRules.push({
    id: options.id ?? `rule_${label}`,
    title: options.title ?? `Answer ${label}`,
    questionIds: [question.id],
    acceptedVariants: options.acceptedVariants ?? [[answer]],
    points: options.points ?? 1,
    ...(options.partialCredit ? { partialCredit: options.partialCredit } : {}),
    ...(question.sectionId ? { sectionId: question.sectionId } : {}),
    ...(question.sectionTitle ? { sectionTitle: question.sectionTitle } : {}),
  });
  sortRules(schema);
}

function addZeroChoice(schema) {
  for (const question of schema.questions ?? []) {
    const choices = (question.choices ?? ["1", "2", "3", "4", "5", "6", "7", "8", "9"]).map(String);
    question.choices = uniqueVariants([["0"], choices].flat().map((choice) => [choice])).map(([choice]) => choice);
  }
}

function setTotal(schema, total) {
  schema.totalPoints = total;
  schema.metadata ??= {};
  schema.metadata.expectedMax = total;
  schema.metadata.visibleExpectedMax = total;
}

function rebuildIntegratedHistoryPublic2025Retake(schema) {
  rebuildSectionedSchema(schema, [
    { id: "geography_integrated", title: "地理総合", answers: ["2", "2", "1", "2", "3", "6", "5", "3", "3", "5", "2", "4", "4", "2", "2", "2"], points: [3, 3, 4, 3, 3, 3, 3, 3, 3, 3, 4, 3, 3, 3, 3, 3] },
    { id: "history_integrated", title: "歴史総合", answers: ["3", "2", "3", "1", "4", "1", "4", "2", "1", "4", "2", "5", "2", "1", "4", "3"], points: [3, 3, 3, 3, 3, 4, 3, 3, 3, 4, 3, 3, 3, 3, 3, 3] },
    { id: "public", title: "公共", answers: ["2", "4", "3", "2", "8", "7", "3", "5", "1", "3", "4", "5", "6", "9", "2", "8"], points: [3, 3, 3, 3, 3, 3, 4, 3, 3, 3, 3, 3, 3, 4, 3, 3] },
  ]);
  schema.selectionGroups = [{
    id: "integrated_history_public_select_two",
    title: "3分野から2分野選択",
    sectionIds: ["geography_integrated", "history_integrated", "public"],
    minSelect: 2,
    maxSelect: 2,
  }];
  setTotal(schema, 100);
}

function rebuildPhysicsBasics2022Retake(schema) {
  schema.questions = [];
  schema.scoringRules = [];
  const rows = [
    ["1", "7", 4], ["2", "2", 4], ["3", "1", 3], ["4", "6", 2], ["5", "5", 4],
    ["6", "3", 2], ["7", "1", 2], ["8", "3", 2], ["9", "2", 2], ["10", "5", 4], ["11", "3", 4], ["12", "3", 3],
    ["13", "2", 2], ["14", "4", 2], ["15", "3", 3], ["16", "2", 2], ["17", "2", 3], ["18", "4", 2],
  ];
  rows.forEach(([label, answer, points], index) => {
    schema.questions.push({
      id: `q_${index + 1}`,
      number: index + 1,
      displayLabel: label,
      correctAnswer: answer,
      prompt: "物理基礎",
      points,
      choices: ["1", "2", "3", "4", "5", "6", "7", "8", "9"],
    });
  });
  const single = (label, points) => setSingleByLabel(schema, label, { id: `rule_${label}`, points });
  ["1", "2", "3", "4", "5", "10", "11", "12"].forEach((label) => {
    const question = findQuestion(schema, label);
    single(label, Number(question.points));
  });
  setCompositeByLabels(schema, ["6", "7"], { id: "rule_6_7_all_or_nothing", points: 4, acceptedVariants: [["3", "1"]] });
  setCompositeByLabels(schema, ["8", "9"], { id: "rule_8_9_all_or_nothing", points: 4, acceptedVariants: [["3", "2"]] });
  setCompositeByLabels(schema, ["13", "14"], { id: "rule_13_14_unordered_partial", points: 4, partialPoints: [2, 2], orderMatters: false });
  setCompositeByLabels(schema, ["15", "16"], {
    id: "rule_15_16_conditional",
    points: 5,
    acceptedVariants: [["3", "2"]],
    partialCredit: [
      { acceptedVariants: [["3", "*"]], points: 3 },
      { acceptedVariants: [["1", "4"], ["2", "3"], ["4", "1"]], points: 2 },
    ],
  });
  setCompositeByLabels(schema, ["17", "18"], {
    id: "rule_17_18_conditional",
    points: 5,
    acceptedVariants: [["2", "4"]],
    partialCredit: [
      { acceptedVariants: [["2", "*"]], points: 3 },
      { acceptedVariants: [["1", "5"], ["3", "3"], ["4", "2"]], points: 2 },
    ],
  });
  setTotal(schema, 50);
}

function rebuildSectionedSchema(schema, sections) {
  schema.questions = [];
  schema.scoringRules = [];
  let questionNo = 1;
  let ruleNo = 1;
  for (const section of sections) {
    section.answers.forEach((answer, index) => {
      const label = String(101 + index);
      const questionId = `q_${questionNo}`;
      schema.questions.push({
        id: questionId,
        number: questionNo,
        displayLabel: label,
        correctAnswer: answer,
        prompt: section.title,
        points: section.points[index],
        sectionId: section.id,
        sectionTitle: section.title,
      });
      schema.scoringRules.push({
        id: `rule_${ruleNo}`,
        title: `${section.title} ${label}`,
        questionIds: [questionId],
        acceptedVariants: [[answer]],
        points: section.points[index],
        sectionId: section.id,
        sectionTitle: section.title,
      });
      questionNo += 1;
      ruleNo += 1;
    });
  }
}

function applyOperation(schema, operation) {
  if (operation.type === "composite") setCompositeByLabels(schema, operation.labels, operation);
  if (operation.type === "single") setSingleByLabel(schema, operation.label, operation);
  if (operation.type === "total") setTotal(schema, operation.total);
  if (operation.type === "addZeroChoice") addZeroChoice(schema);
  if (operation.type === "clearSelectionGroups") schema.selectionGroups = [];
  if (operation.type === "rebuildIntegratedHistoryPublic2025Retake") rebuildIntegratedHistoryPublic2025Retake(schema);
  if (operation.type === "rebuildPhysicsBasics2022Retake") rebuildPhysicsBasics2022Retake(schema);
}

for (const checklistRule of EXPLICIT_MARKSHEET_RULES) {
  updateExam(checklistRule.examId, (schema) => {
    checklistRule.operations.forEach((operation) => applyOperation(schema, operation));
  });
}
