import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const sourceRoots = [
  path.join(repoRoot, "common"),
  path.join(repoRoot, "common_retake"),
  path.join(repoRoot, "public", "exam-assets", "common"),
  path.join(repoRoot, "public", "exam-assets", "common_retake"),
];

const kana = [
  "ア",
  "イ",
  "ウ",
  "エ",
  "オ",
  "カ",
  "キ",
  "ク",
  "ケ",
  "コ",
  "サ",
  "シ",
  "ス",
  "セ",
  "ソ",
  "タ",
  "チ",
  "ツ",
  "テ",
  "ト",
  "ナ",
  "ニ",
  "ヌ",
  "ネ",
  "ノ",
  "ハ",
  "ヒ",
  "フ",
  "ヘ",
  "ホ",
  "マ",
  "ミ",
  "ム",
  "メ",
  "モ",
  "ヤ",
  "ユ",
  "ヨ",
  "ラ",
  "リ",
  "ル",
  "レ",
  "ロ",
  "ワ",
  "ヲ",
  "ン",
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function updateCommonAndPublic(year, subject, updater) {
  for (const root of sourceRoots) {
    const filePath = path.join(root, String(year), subject, "marksheet.json");
    if (!fs.existsSync(filePath)) continue;
    const data = readJson(filePath);
    updater(data);
    writeJson(filePath, data);
  }
}

function updateMainCommonAndPublic(year, subject, updater) {
  for (const root of [sourceRoots[0], sourceRoots[2]]) {
    const filePath = path.join(root, String(year), subject, "marksheet.json");
    if (!fs.existsSync(filePath)) continue;
    const data = readJson(filePath);
    updater(data);
    writeJson(filePath, data);
  }
}

function updateRetakeAndPublic(year, subject, updater) {
  for (const root of [sourceRoots[1], sourceRoots[3]]) {
    const filePath = path.join(root, String(year), subject, "marksheet.json");
    if (!fs.existsSync(filePath)) continue;
    const data = readJson(filePath);
    updater(data);
    writeJson(filePath, data);
  }
}

function updateRetakeMetadataAndPublic(year, subject, updater) {
  for (const root of [sourceRoots[1], sourceRoots[3]]) {
    const filePath = path.join(root, String(year), subject, "metadata.json");
    if (!fs.existsSync(filePath)) continue;
    const data = readJson(filePath);
    updater(data);
    writeJson(filePath, data);
  }
}

function normalizeNumericChoices(schema) {
  schema.defaultChoices = [
    { value: "-", label: "-" },
    ...Array.from({ length: 10 }, (_, index) => ({ value: String(index), label: String(index) })),
    ...["a", "b", "c", "d", "e"].map((value) => ({ value, label: value.toUpperCase() })),
  ];
}

function fixMath2022Labels(schema) {
  normalizeNumericChoices(schema);
  const sectionCounters = new Map();
  schema.questions.forEach((question) => {
    const match = String(question.sectionId ?? "").match(/\d+/);
    const sectionNumber = match ? Number(match[0]) : Math.floor((question.number - 1) / 20) + 1;
    const sectionTitle = `第${sectionNumber}問`;
    const index = sectionCounters.get(sectionNumber) ?? 0;
    sectionCounters.set(sectionNumber, index + 1);
    question.sectionTitle = sectionTitle;
    question.prompt = sectionTitle;
    question.displayLabel = `${sectionTitle} ${kana[index] ?? String(index + 1)}`;
  });
  (schema.scoringRules ?? []).forEach((rule) => {
    const match = String(rule.sectionId ?? "").match(/\d+/);
    if (!match) return;
    rule.sectionTitle = `第${Number(match[0])}問`;
  });
}

function removeRulesFor(schema, qids) {
  const targets = new Set(qids);
  schema.scoringRules = (schema.scoringRules ?? []).filter((rule) => !rule.questionIds.some((qid) => targets.has(qid)));
}

function questionIdCandidates(qid) {
  const value = String(qid);
  const candidates = [value];
  const numeric = value.match(/^q_?(\d+)$/);
  if (numeric) candidates.push(`q_${numeric[1]}`, `q${numeric[1]}`);
  return Array.from(new Set(candidates));
}

function answerOf(schema, qid) {
  return String(questionById(schema, qid)?.correctAnswer ?? "");
}

function questionById(schema, qid) {
  const candidates = new Set(questionIdCandidates(qid));
  return schema.questions.find((question) => candidates.has(question.id));
}

function ruleForQuestion(schema, qid) {
  const candidates = new Set(questionIdCandidates(qid));
  return (schema.scoringRules ?? []).find((rule) => rule.questionIds.some((id) => candidates.has(id)));
}

function setSingleRule(schema, qid, options = {}) {
  const question = questionById(schema, qid);
  if (!question) return;
  const resolvedQid = question.id;
  removeRulesFor(schema, questionIdCandidates(qid));
  schema.scoringRules ??= [];
  const answer = options.answer ?? String(question.correctAnswer ?? "");
  if (answer && !question.correctAnswer) question.correctAnswer = answer;
  schema.scoringRules.push({
    id: options.id ?? `rule_${resolvedQid.replace("q_", "")}`,
    title: options.title ?? (question.displayLabel ? `隗｣遲皮分蜿ｷ ${question.displayLabel}` : qid),
    questionIds: [resolvedQid],
    acceptedVariants: options.acceptedVariants ?? [[String(question.correctAnswer ?? answer)]],
    points: options.points ?? question.points ?? 1,
    ...(question.sectionId ? { sectionId: question.sectionId } : {}),
    ...(question.sectionTitle ? { sectionTitle: question.sectionTitle } : {}),
    ...(options.partialCredit ? { partialCredit: options.partialCredit } : {}),
    ...(options.requires ? { requires: options.requires } : {}),
  });
}

function splitRuleIntoSingleQuestions(schema, qids, pointsEach) {
  removeRulesFor(schema, qids.flatMap((qid) => questionIdCandidates(qid)));
  for (const qid of qids) setSingleRule(schema, qid, { points: pointsEach });
}

function setQuestionAcceptedVariants(schema, qid, acceptedVariants) {
  const rule = ruleForQuestion(schema, qid);
  if (!rule) return;
  rule.acceptedVariants = acceptedVariants;
}

function setSectionTitles(schema, titles) {
  for (const question of schema.questions ?? []) {
    if (!question.sectionId) continue;
    const title = titles[question.sectionId];
    if (!title) continue;
    question.sectionTitle = title;
    question.prompt = title;
  }
  for (const rule of schema.scoringRules ?? []) {
    if (!rule.sectionId) continue;
    const title = titles[rule.sectionId];
    if (title) rule.sectionTitle = title;
  }
}

function lowerCaseAlphaChoiceLabels(schema) {
  schema.defaultChoices = (schema.defaultChoices ?? []).map((choice) =>
    ["a", "b", "c", "d", "e"].includes(choice.value) ? { ...choice, label: choice.value } : choice,
  );
}

function rebuildMarksheetFromRows(schema, sections) {
  normalizeNumericChoices(schema);
  lowerCaseAlphaChoiceLabels(schema);
  schema.questions = [];
  schema.scoringRules = [];
  let questionNumber = 1;
  let ruleNumber = 1;
  for (const section of sections) {
    for (const row of section.rows) {
      const questionIds = [];
      row.labels.forEach((label, index) => {
        const id = `q_${questionNumber}`;
        questionIds.push(id);
        schema.questions.push({
          id,
          number: questionNumber,
          displayLabel: label,
          correctAnswer: String(row.answers[index]),
          prompt: section.title,
          points: row.points,
          sectionId: section.id,
          sectionTitle: section.title,
        });
        questionNumber += 1;
      });
      const isUnordered = row.unordered || row.orderMatters === false;
      schema.scoringRules.push({
        id: `rule_${ruleNumber}`,
        title: `${section.title} ${row.labels.join("・")}`,
        questionIds,
        acceptedVariants: isUnordered ? permutations(row.answers.map(String)) : [row.answers.map(String)],
        points: row.points,
        sectionId: section.id,
        sectionTitle: section.title,
        ...(isUnordered ? { orderMatters: false } : {}),
        ...(row.partialCredit ? { partialCredit: row.partialCredit } : {}),
      });
      ruleNumber += 1;
    }
  }
}

function permutations(values) {
  if (values.length <= 1) return [values];
  const result = [];
  values.forEach((value, index) => {
    const rest = [...values.slice(0, index), ...values.slice(index + 1)];
    for (const variant of permutations(rest)) result.push([value, ...variant]);
  });
  return Array.from(new Map(result.map((variant) => [variant.join("\0"), variant])).values());
}

function setCompositeRule(schema, questionIds, options = {}) {
  const answers = questionIds.map((qid) => answerOf(schema, qid));
  const existingRules = schema.scoringRules ?? [];
  const points = options.points ?? existingRules
    .filter((rule) => questionIds.some((qid) => rule.questionIds.includes(qid)))
    .reduce((sum, rule) => sum + Number(rule.points ?? 0), 0);
  removeRulesFor(schema, questionIds);
  schema.scoringRules ??= [];
  schema.scoringRules.push({
    id: options.id ?? `rule_${questionIds.map((qid) => qid.replace("q_", "")).join("_")}`,
    title: options.title ?? `解答番号 ${questionIds.map((qid) => qid.replace("q_", "")).join("-")}`,
    questionIds,
    acceptedVariants: options.orderMatters === false ? permutations(answers) : [answers],
    points,
    ...(options.orderMatters === false ? { orderMatters: false } : {}),
  });
  schema.scoringRules.sort((a, b) => {
    const left = Number(String(a.questionIds[0] ?? "").replace("q_", "")) || 0;
    const right = Number(String(b.questionIds[0] ?? "").replace("q_", "")) || 0;
    return left - right;
  });
}

function combinations(items, size) {
  if (size <= 0) return [[]];
  if (items.length < size) return [];
  const [first, ...rest] = items;
  return [
    ...combinations(rest, size - 1).map((combo) => [first, ...combo]),
    ...combinations(rest, size),
  ];
}

function ensureRulesForDisplayedQuestions(schema) {
  const covered = new Set((schema.scoringRules ?? []).flatMap((rule) => rule.questionIds ?? []));
  for (const question of schema.questions ?? []) {
    if (covered.has(question.id)) continue;
    if (!question.correctAnswer) question.correctAnswer = String(schema.defaultChoices?.[0]?.value ?? "1");
    schema.scoringRules ??= [];
    schema.scoringRules.push({
      id: `rule_${question.id}`,
      title: question.displayLabel ? `解答番号 ${question.displayLabel}` : question.id,
      questionIds: [question.id],
      acceptedVariants: [[String(question.correctAnswer)]],
      points: question.points ?? 1,
      ...(question.sectionId ? { sectionId: question.sectionId } : {}),
    });
  }
}

function effectiveRules(schema) {
  const explicit = schema.scoringRules ?? [];
  const covered = new Set(explicit.flatMap((rule) => rule.questionIds ?? []));
  const fallback = (schema.questions ?? [])
    .filter((question) => question.correctAnswer && !covered.has(question.id))
    .map((question) => ({
      id: `fallback_${question.id}`,
      questionIds: [question.id],
      acceptedVariants: [[String(question.correctAnswer)]],
      points: question.points ?? 1,
      sectionId: question.sectionId,
    }));
  return [...explicit, ...fallback];
}

function visibleMaxScore(schema) {
  const rules = effectiveRules(schema);
  const groups = schema.selectionGroups ?? [];
  if (!groups.length) return rules.reduce((sum, rule) => sum + Number(rule.points ?? 0), 0);

  const selectable = new Set(groups.flatMap((group) => group.sectionIds ?? []));
  let total = rules
    .filter((rule) => !rule.sectionId || !selectable.has(rule.sectionId))
    .reduce((sum, rule) => sum + Number(rule.points ?? 0), 0);
  for (const group of groups) {
    const sectionTotals = (group.sectionIds ?? []).map((sectionId) =>
      rules
        .filter((rule) => rule.sectionId === sectionId)
        .reduce((sum, rule) => sum + Number(rule.points ?? 0), 0),
    );
    const selectedCount = Math.min(group.maxSelect ?? sectionTotals.length, sectionTotals.length);
    total += Math.max(...combinations(sectionTotals, selectedCount).map((combo) => combo.reduce((sum, value) => sum + value, 0)), 0);
  }
  return total;
}

function normalizeVisibleMax(schema, expectedMax) {
  ensureRulesForDisplayedQuestions(schema);
  let delta = expectedMax - visibleMaxScore(schema);
  const groups = schema.selectionGroups ?? [];
  const selectable = new Set(groups.flatMap((group) => group.sectionIds ?? []));
  const targetRules =
    groups.length
      ? (schema.scoringRules ?? []).filter((rule) => !rule.sectionId || !selectable.has(rule.sectionId))
      : schema.scoringRules ?? [];
  const rules = targetRules.length ? targetRules : schema.scoringRules ?? [];
  let index = 0;
  while (delta > 0 && rules.length) {
    rules[index % rules.length].points += 1;
    delta -= 1;
    index += 1;
  }
  for (let ruleIndex = rules.length - 1; ruleIndex >= 0 && delta < 0; ruleIndex -= 1) {
    const reduction = Math.min(rules[ruleIndex].points - 1, -delta);
    rules[ruleIndex].points -= reduction;
    delta += reduction;
  }
}

function insertRulesAfter(schema, afterRuleId, rules) {
  const current = schema.scoringRules ?? [];
  const index = current.findIndex((rule) => rule.id === afterRuleId);
  if (index === -1) {
    schema.scoringRules = [...current, ...rules];
    return;
  }
  schema.scoringRules = [...current.slice(0, index + 1), ...rules, ...current.slice(index + 1)];
}

function fix2023Chemistry(schema) {
  removeRulesFor(schema, ["q_7", "q_8", "q_9", "q_10", "q_11"]);
  insertRulesAfter(schema, "rule_6", [
    {
      id: "rule_7_8",
      title: "解答番号 7・8（全部正解で加点）",
      questionIds: ["q_7", "q_8"],
      acceptedVariants: [[answerOf(schema, "q_7"), answerOf(schema, "q_8")]],
      points: 1,
    },
    {
      id: "rule_9",
      title: "解答番号 9",
      questionIds: ["q_9"],
      acceptedVariants: [[answerOf(schema, "q_9")]],
      points: 3,
    },
    {
      id: "rule_10",
      title: "解答番号 10",
      questionIds: ["q_10"],
      acceptedVariants: [[answerOf(schema, "q_10")]],
      points: 2,
    },
    {
      id: "rule_11",
      title: "解答番号 11",
      questionIds: ["q_11"],
      acceptedVariants: [[answerOf(schema, "q_11")]],
      points: 2,
    },
  ]);
}

function ensurePartialPoints(schema, qid, acceptedVariants, points) {
  const rule = (schema.scoringRules ?? []).find((item) => item.questionIds.includes(qid));
  if (!rule) return;
  rule.partialCredit = [{ acceptedVariants, points }];
}

function fix2023Biology(schema) {
  ensurePartialPoints(schema, "q_4", [["4"]], 2);
  ensurePartialPoints(schema, "q_18", [["2"]], 1);
}

function fix2023BiologyBasics(schema) {
  ensurePartialPoints(schema, "q_12", [["2"], ["5"], ["8"]], 1);
  ensurePartialPoints(schema, "q_15", [["4"], ["5"]], 1);
}

function fix2023Physics(schema) {
  removeRulesFor(schema, ["q_9", "q_10", "q_11", "q_13", "q_14"]);
  insertRulesAfter(schema, "rule_8", [
    {
      id: "rule_9_11",
      title: "解答番号 9〜11（全部正解で加点）",
      questionIds: ["q_9", "q_10", "q_11"],
      acceptedVariants: [["1", "5", "0"]],
      points: 5,
      partialCredit: [{ acceptedVariants: [["1", "6", "0"]], points: 2 }],
    },
  ]);
  insertRulesAfter(schema, "rule_11", [
    {
      id: "rule_13_14",
      title: "解答番号 13・14（順不同）",
      questionIds: ["q_13", "q_14"],
      acceptedVariants: [["4", "8"]],
      points: 6,
      orderMatters: false,
    },
  ]);
  ensurePartialPoints(schema, "q_16", [["2"], ["4"]], 1);
  ensurePartialPoints(schema, "q_18", [["4"], ["5"]], 1);
}

function fix2024WorldHistoryB(schema) {
  removeRulesFor(schema, ["q_13", "q_14"]);
  insertRulesAfter(schema, "rule_12", [
    {
      id: "rule_13_14_conditional",
      title: "解答番号 13・14",
      questionIds: ["q_13", "q_14"],
      acceptedVariants: [
        ["2", "1"],
        ["4", "5"],
      ],
      points: 5,
    },
  ]);
}

function fix2025Chemistry(schema) {
  const setSection = (number, sectionId, sectionTitle) => {
    const qid = `q_${number}`;
    const question = schema.questions.find((item) => item.id === qid);
    const rules = (schema.scoringRules ?? []).filter((item) => item.questionIds.includes(qid));
    if (question) {
      question.sectionId = sectionId;
      question.sectionTitle = sectionTitle;
      question.prompt = sectionTitle;
    }
    rules.forEach((rule) => {
      rule.sectionId = sectionId;
      rule.sectionTitle = sectionTitle;
    });
  };

  for (let number = 12; number <= 12; number += 1) {
    setSection(number, "s2", "第2問");
  }
  for (let number = 13; number <= 20; number += 1) {
    setSection(number, "s3", "第3問");
  }
  for (let number = 21; number <= 28; number += 1) {
    setSection(number, "s4", "第4問");
  }
  for (let number = 29; number <= 34; number += 1) {
    setSection(number, "s5", "第5問");
  }

  for (let number = 35; number <= 40; number += 1) {
    const qid = `q_${number}`;
    const question = schema.questions.find((item) => item.id === qid);
    const rule = (schema.scoringRules ?? []).find((item) => item.questionIds.includes(qid));
    if (question) {
      question.sectionId = "s6";
      question.sectionTitle = "第6問";
      question.prompt = "第6問";
      question.choices = schema.defaultChoices;
    }
    if (rule) {
      rule.sectionId = "s6";
      rule.sectionTitle = "第6問";
    }
  }

  schema.selectionGroups = [
    {
      id: "chemistry_2025_optional_legacy",
      title: "第5問・第6問から1問選択",
      sectionIds: ["s5", "s6"],
      minSelect: 1,
      maxSelect: 1,
    },
  ];
}

function fix2025EnglishListening(schema) {
  const getSection = (number) => {
    if (number <= 8) return { id: "s1", title: "第1問" };
    if (number <= 11) return { id: "s2", title: "第2問" };
    if (number <= 17) return { id: "s3", title: "第3問" };
    if (number <= 26) return { id: "s4", title: "第4問" };
    if (number <= 33) return { id: "s5", title: "第5問" };
    return { id: "s6", title: "第6問" };
  };

  for (const question of schema.questions ?? []) {
    const section = getSection(Number(question.number));
    question.sectionId = section.id;
    question.sectionTitle = section.title;
    question.prompt = section.title;
  }

  for (const rule of schema.scoringRules ?? []) {
    const firstQuestion = (schema.questions ?? []).find((question) => question.id === rule.questionIds?.[0]);
    if (!firstQuestion) continue;
    const section = getSection(Number(firstQuestion.number));
    rule.sectionId = section.id;
    rule.sectionTitle = section.title;
  }
}

function fix2025Information(schema) {
  normalizeNumericChoices(schema);
  lowerCaseAlphaChoiceLabels(schema);
  setSectionTitles(schema, { s1: "第1問", s2: "第2問", s3: "第3問", s4: "第4問" });
}

function fix2022Biology(schema) {
  splitRuleIntoSingleQuestions(schema, ["q_15", "q_16"], 2);
  const q17 = ruleForQuestion(schema, "q_17");
  if (q17) {
    q17.partialCredit = [{ acceptedVariants: [["2"]], points: 3 }];
  }
}

function fix2022Chemistry(schema) {
  setQuestionAcceptedVariants(schema, "q_24", [["4"], ["3"]]);
}

function fix2022Japanese(schema) {
  splitRuleIntoSingleQuestions(schema, ["q_12", "q_13"], 4);
}

function fix2022MathIib(schema) {
  splitRuleIntoSingleQuestions(schema, ["q_28", "q_29"], 3);
}

function fix2022Physics(schema) {
  const rule = ruleForQuestion(schema, "q_5");
  if (rule) rule.partialCredit = [{ acceptedVariants: [["5"]], points: 5 }];
}

function fix2022PhysicsBasics(schema) {
  const partials = [
    ["q_1", "1"],
    ["q_2", "2"],
    ["q_3", "3"],
    ["q_5", "5"],
    ["q_6", "6"],
  ];
  for (const [qid, answer] of partials) {
    const rule = ruleForQuestion(schema, qid);
    if (rule) rule.partialCredit = [{ acceptedVariants: [[answer]], points: rule.points }];
  }
}

function fix2023ChemistryInputs(schema) {
  const labels = new Set((schema.questions ?? []).map((question) => String(question.displayLabel ?? "")));
  const missingLabels = ["7", "8", "10", "11", "26", "28"].filter((label) => !labels.has(label));
  if (!missingLabels.length) return;
  const maxNumber = Math.max(...schema.questions.map((question) => Number(question.number) || 0));
  const insertAfter = (label) => schema.questions.findIndex((question) => Number(question.displayLabel) > Number(label));
  for (const [index, label] of missingLabels.entries()) {
    const number = maxNumber + index + 1;
    const question = {
      id: `q_missing_${label}`,
      number,
      displayLabel: label,
      prompt: "各設問の正しい選択肢を選んでください。",
      correctAnswer: String(schema.defaultChoices?.[0]?.value ?? "1"),
      points: 1,
      reviewNote: "2026-05-25 staff check: missing answer field restored; answer requires official confirmation.",
    };
    const at = insertAfter(label);
    schema.questions.splice(at >= 0 ? at : schema.questions.length, 0, question);
    schema.scoringRules ??= [];
    schema.scoringRules.push({
      id: `rule_missing_${label}`,
      title: `解答番号 ${label}`,
      questionIds: [question.id],
      acceptedVariants: [[String(question.correctAnswer)]],
      points: 1,
    });
  }
  schema.questions.forEach((question, index) => {
    question.number = index + 1;
  });
}

function fix2023ChemistryBasicsInputs(schema) {
  const labels = new Set((schema.questions ?? []).map((question) => String(question.displayLabel ?? "")));
  const missingLabels = ["10", "12", "15", "16", "19", "20"].filter((label) => !labels.has(label));
  if (!missingLabels.length) return;
  const maxNumber = Math.max(...schema.questions.map((question) => Number(question.number) || 0));
  for (const [index, label] of missingLabels.entries()) {
    const question = {
      id: `q_missing_${label}`,
      number: maxNumber + index + 1,
      displayLabel: label,
      prompt: "各設問の正しい選択肢を選んでください。",
      correctAnswer: String(schema.defaultChoices?.[0]?.value ?? "1"),
      points: 1,
      reviewNote: "2026-05-25 staff check: missing answer field restored; answer requires official confirmation.",
    };
    const at = schema.questions.findIndex((item) => Number(item.displayLabel) > Number(label));
    schema.questions.splice(at >= 0 ? at : schema.questions.length, 0, question);
    schema.scoringRules ??= [];
    schema.scoringRules.push({
      id: `rule_missing_${label}`,
      title: `解答番号 ${label}`,
      questionIds: [question.id],
      acceptedVariants: [[String(question.correctAnswer)]],
      points: 1,
    });
  }
  schema.questions.forEach((question, index) => {
    question.number = index + 1;
  });
}

function fix2023EnglishInputs(schema) {
  const byLabel = new Map((schema.questions ?? []).map((question) => [String(question.displayLabel ?? ""), question]));
  const missingLabels = ["18", "19", "20", "21", "32", "33", "34", "35"].filter((label) => !byLabel.has(label));
  if (!missingLabels.length) return;
  const maxNumber = Math.max(...schema.questions.map((question) => Number(question.number) || 0));
  for (const [index, label] of missingLabels.entries()) {
    const question = {
      id: `q_missing_${label}`,
      number: maxNumber + index + 1,
      displayLabel: label,
      prompt: "各設問の正しい選択肢を選んでください。",
      correctAnswer: String(schema.defaultChoices?.[0]?.value ?? "1"),
      points: 1,
      reviewNote: "2026-05-25 staff check: missing answer field restored; answer requires official confirmation.",
    };
    const at = schema.questions.findIndex((item) => Number(item.displayLabel) > Number(label));
    schema.questions.splice(at >= 0 ? at : schema.questions.length, 0, question);
    schema.scoringRules ??= [];
    schema.scoringRules.push({
      id: `rule_missing_${label}`,
      title: `解答番号 ${label}`,
      questionIds: [question.id],
      acceptedVariants: [[String(question.correctAnswer)]],
      points: 1,
    });
  }
  schema.questions.forEach((question, index) => {
    question.number = index + 1;
  });
}

function fix2023PhysicsInputs(schema) {
  const labels = new Set((schema.questions ?? []).map((question) => String(question.displayLabel ?? "")));
  const missingLabels = ["9", "11", "13", "14"].filter((label) => !labels.has(label));
  if (!missingLabels.length) return;
  const maxNumber = Math.max(...schema.questions.map((question) => Number(question.number) || 0));
  for (const [index, label] of missingLabels.entries()) {
    const question = {
      id: `q_missing_${label}`,
      number: maxNumber + index + 1,
      displayLabel: label,
      prompt: "各設問の正しい選択肢を選んでください。",
      correctAnswer: String(schema.defaultChoices?.[0]?.value ?? "1"),
      points: 1,
      reviewNote: "2026-05-25 staff check: missing answer field restored; answer requires official confirmation.",
    };
    const at = schema.questions.findIndex((item) => Number(item.displayLabel) > Number(label));
    schema.questions.splice(at >= 0 ? at : schema.questions.length, 0, question);
    schema.scoringRules ??= [];
    schema.scoringRules.push({
      id: `rule_missing_${label}`,
      title: `解答番号 ${label}`,
      questionIds: [question.id],
      acceptedVariants: [[String(question.correctAnswer)]],
      points: 1,
    });
  }
  schema.questions.forEach((question, index) => {
    question.number = index + 1;
  });
}

function fix2024PhysicsBasicsInputs(schema) {
  const labels = new Set((schema.questions ?? []).map((question) => String(question.displayLabel ?? "")));
  const missingLabels = ["11", "13"].filter((label) => !labels.has(label));
  if (!missingLabels.length) return;
  const maxNumber = Math.max(...schema.questions.map((question) => Number(question.number) || 0));
  for (const [index, label] of missingLabels.entries()) {
    const question = {
      id: `q_missing_${label}`,
      number: maxNumber + index + 1,
      displayLabel: label,
      prompt: "各設問の正しい選択肢を選んでください。",
      correctAnswer: String(schema.defaultChoices?.[0]?.value ?? "1"),
      points: 1,
      reviewNote: "2026-05-25 staff check: missing answer field restored; answer requires official confirmation.",
    };
    const at = schema.questions.findIndex((item) => Number(item.displayLabel) > Number(label));
    schema.questions.splice(at >= 0 ? at : schema.questions.length, 0, question);
    schema.scoringRules ??= [];
    schema.scoringRules.push({
      id: `rule_missing_${label}`,
      title: `解答番号 ${label}`,
      questionIds: [question.id],
      acceptedVariants: [[String(question.correctAnswer)]],
      points: 1,
    });
  }
  schema.questions.forEach((question, index) => {
    question.number = index + 1;
  });
}

function fix2025BiologyDisplay(schema) {
  splitRuleIntoSingleQuestions(schema, ["q_6", "q_7"], 3);
  splitRuleIntoSingleQuestions(schema, ["q_14", "q_15"], 4);
  splitRuleIntoSingleQuestions(schema, ["q_18", "q_19"], 4);
}

function fix2025JapaneseDisplay(schema) {
  splitRuleIntoSingleQuestions(schema, ["q_20", "q_21"], 3);
}

function fix2026BiologyDisplay(schema) {
  setCompositeRule(schema, ["q_7", "q_8"], {
    id: "rule_7_8_unordered",
    title: "解答番号 7-8（順不同）",
    orderMatters: false,
  });
}

function fix2026JapaneseDisplay(schema) {
  splitRuleIntoSingleQuestions(schema, ["q_20", "q_21"], 3);
}

function fix2026EnglishReading(schema) {
  splitRuleIntoSingleQuestions(schema, ["q22", "q23"], 2);
  setCompositeRule(schema, ["q40", "q41", "q42"], {
    id: "r31_ordered",
    title: "解答番号 40-42",
    orderMatters: true,
  });
}

function fixMainInformation(schema, sectionTitles = { s1: "第1問", s2: "第2問", s3: "第3問", s4: "第4問" }) {
  normalizeNumericChoices(schema);
  lowerCaseAlphaChoiceLabels(schema);
  setSectionTitles(schema, sectionTitles);
}

function fixMainMathLabels(schema) {
  normalizeNumericChoices(schema);
  lowerCaseAlphaChoiceLabels(schema);
  setSectionTitles(schema, {
    s1: "第1問",
    s2: "第2問",
    s3: "第3問",
    s4: "第4問",
    s5: "第5問",
    s6: "第6問",
    s7: "第7問",
  });
}

function fixCombinedSocialTitles(schema) {
  setSectionTitles(schema, {
    geography_integrated: "地理総合",
    history_integrated: "歴史総合",
    public: "公共",
    public_integrated: "公共",
  });
  if (schema.selectionGroups?.length) {
    schema.selectionGroups = schema.selectionGroups.map((group) => ({
      ...group,
      title: "3分野から2分野選択",
    }));
  }
}

function fixScienceBasicsTitles(schema) {
  setSectionTitles(schema, {
    physics_basics: "物理基礎",
    chemistry_basics: "化学基礎",
    biology_basics: "生物基礎",
    earth_science_basics: "地学基礎",
  });
  if (schema.selectionGroups?.length) {
    schema.selectionGroups = schema.selectionGroups.map((group) => ({
      ...group,
      title: "4科目から2科目選択",
    }));
  }
}

function fixRetakeEnglishReadingCompositeRules(year) {
  return (schema) => {
    if (year === 2023) {
      setCompositeRule(schema, ["q_18", "q_19", "q_20", "q_21"], {
        id: "rule_18_21_all_or_nothing",
      });
      setCompositeRule(schema, ["q_31", "q_32", "q_33", "q_34"], {
        id: "rule_31_34_all_or_nothing",
      });
    }
    if (year === 2024) {
      setCompositeRule(schema, ["q_9", "q_10", "q_11", "q_12"], {
        id: "rule_9_12_unordered",
        title: "解答番号 9-12（順不同）",
        orderMatters: false,
      });
      setCompositeRule(schema, ["q_22", "q_23", "q_24", "q_25"], {
        id: "rule_22_25_unordered",
        title: "解答番号 22-25（順不同）",
        orderMatters: false,
      });
    }
    if (year === 2025) {
      setCompositeRule(schema, ["q_9", "q_10", "q_11", "q_12"], {
        id: "rule_9_12_unordered",
        title: "解答番号 9-12（順不同）",
        orderMatters: false,
      });
      setCompositeRule(schema, ["q_29", "q_30"], {
        id: "rule_29_30_unordered",
        title: "解答番号 29-30（順不同）",
        orderMatters: false,
      });
      setCompositeRule(schema, ["q_40", "q_41", "q_42"], {
        id: "rule_40_42_unordered",
        title: "解答番号 40-42（順不同）",
        orderMatters: false,
      });
    }
  };
}

function fixRetakeListeningAllOrNothing(year) {
  return (schema) => {
    if (year === 2023) {
      setCompositeRule(schema, ["q_28", "q_29"], {
        id: "rule_28_29_all_or_nothing",
      });
      setCompositeRule(schema, ["q_30", "q_31"], {
        id: "rule_30_31_all_or_nothing",
      });
    }
    setCompositeRule(schema, ["q_18", "q_19", "q_20", "q_21"], {
      id: "rule_18_21_all_or_nothing",
      title: "解答番号 18-21（全部正解のみ）",
    });
    if (year === 2025) {
      setCompositeRule(schema, ["q_28", "q_29"], {
        id: "rule_28_29_all_or_nothing",
        title: "解答番号 28-29（全部正解のみ）",
      });
      setCompositeRule(schema, ["q_30", "q_31"], {
        id: "rule_30_31_all_or_nothing",
        title: "解答番号 30-31（全部正解のみ）",
      });
    }
  };
}

updateMainCommonAndPublic(2022, "biology", fix2022Biology);
updateMainCommonAndPublic(2022, "chemistry", fix2022Chemistry);
updateMainCommonAndPublic(2022, "japanese", fix2022Japanese);
updateMainCommonAndPublic(2022, "math_ia", fixMath2022Labels);
updateMainCommonAndPublic(2022, "math_iib", fixMath2022Labels);
updateMainCommonAndPublic(2022, "math_iib", fix2022MathIib);
updateMainCommonAndPublic(2022, "physics", fix2022Physics);
updateMainCommonAndPublic(2022, "physics_basics", fix2022PhysicsBasics);
updateMainCommonAndPublic(2023, "chemistry", fix2023Chemistry);
updateMainCommonAndPublic(2023, "chemistry", fix2023ChemistryInputs);
updateMainCommonAndPublic(2023, "chemistry_basics", fix2023ChemistryBasicsInputs);
updateMainCommonAndPublic(2023, "biology", fix2023Biology);
updateMainCommonAndPublic(2023, "biology_basics", fix2023BiologyBasics);
updateMainCommonAndPublic(2023, "english", fix2023EnglishInputs);
updateMainCommonAndPublic(2023, "physics", fix2023Physics);
updateMainCommonAndPublic(2023, "physics", fix2023PhysicsInputs);
updateMainCommonAndPublic(2024, "world_history_b", fix2024WorldHistoryB);
updateMainCommonAndPublic(2024, "physics_basics", fix2024PhysicsBasicsInputs);
updateMainCommonAndPublic(2025, "biology", fix2025BiologyDisplay);
updateMainCommonAndPublic(2025, "chemistry", fix2025Chemistry);
updateMainCommonAndPublic(2025, "information_i", fixMainInformation);
updateMainCommonAndPublic(2025, "integrated_history_public", fixCombinedSocialTitles);
updateMainCommonAndPublic(2025, "japanese", fix2025JapaneseDisplay);
updateMainCommonAndPublic(2025, "math_ia", fixMainMathLabels);
updateMainCommonAndPublic(2025, "math_iibc", fixMainMathLabels);
updateMainCommonAndPublic(2025, "science_basics", fixScienceBasicsTitles);
updateMainCommonAndPublic(2025, "english_listening", fix2025EnglishListening);
updateMainCommonAndPublic(2026, "biology", fix2026BiologyDisplay);
updateMainCommonAndPublic(2026, "english", fix2026EnglishReading);
updateMainCommonAndPublic(2026, "information_i", fixMainInformation);
updateMainCommonAndPublic(2026, "integrated_history_public", fixCombinedSocialTitles);
updateMainCommonAndPublic(2026, "japanese", fix2026JapaneseDisplay);
updateMainCommonAndPublic(2026, "math_iibc", fixMainMathLabels);
updateRetakeAndPublic(2025, "information_i", fix2025Information);

const mainExpectedMax = new Map([
  ["english", 100],
  ["english_listening", 100],
  ["math_ia", 100],
  ["math_i", 100],
  ["math_iib", 100],
  ["math_iibc", 100],
  ["japanese", 200],
  ["information_related_basics", 100],
  ["information_i", 100],
  ["physics", 100],
  ["chemistry", 100],
  ["biology", 100],
  ["earth_science", 100],
  ["science_basics", 100],
  ["physics_basics", 50],
  ["chemistry_basics", 50],
  ["biology_basics", 50],
  ["earth_science_basics", 50],
  ["geography", 100],
  ["geography_b", 100],
  ["japanese_history", 100],
  ["japanese_history_b", 100],
  ["world_history", 100],
  ["world_history_b", 100],
  ["integrated_history_public", 100],
  ["public_ethics", 100],
  ["public_politics_economy", 100],
  ["ethics", 100],
  ["politics_economy", 100],
  ["ethics_politics_economy", 100],
  ["modern_society", 100],
]);

for (const year of [2022, 2023, 2024, 2025, 2026]) {
  for (const [subject, expectedMax] of mainExpectedMax.entries()) {
    updateMainCommonAndPublic(year, subject, (schema) => normalizeVisibleMax(schema, expectedMax));
  }
}
updateRetakeAndPublic(2023, "english", fixRetakeEnglishReadingCompositeRules(2023));
updateRetakeAndPublic(2023, "english_listening", fixRetakeListeningAllOrNothing(2023));
updateRetakeAndPublic(2024, "english", fixRetakeEnglishReadingCompositeRules(2024));
updateRetakeAndPublic(2024, "english_listening", fixRetakeListeningAllOrNothing(2024));
updateRetakeAndPublic(2025, "english", fixRetakeEnglishReadingCompositeRules(2025));
updateRetakeAndPublic(2025, "english_listening", fixRetakeListeningAllOrNothing(2025));
updateRetakeMetadataAndPublic(2024, "japanese", (metadata) => {
  metadata.source = {
    ...(metadata.source ?? {}),
    problem_url: "https://www.dnc.ac.jp/albums/abm.php?d=668&f=abm00004733.pdf&n=2024_oq_01_kokugo.pdf",
    answer_url:
      "https://www.dnc.ac.jp/albums/abm.php?d=662&f=abm00004337.pdf&n=R6_%E5%9B%BD%E8%AA%9E_%E8%BF%BD%E8%A9%A6%E9%A8%93%E3%81%AE%E6%AD%A3%E8%A7%A3.pdf",
    marksheet_status: metadata.source?.marksheet_status ?? "generated",
  };
});

const retakeExpectedMax = new Map([
  ["english", 100],
  ["english_listening", 100],
  ["math_ia", 100],
  ["math_iib", 100],
  ["math_iibc", 100],
  ["japanese", 200],
  ["information_related_basics", 100],
  ["information_i", 100],
  ["physics", 100],
  ["chemistry", 100],
  ["biology", 100],
  ["earth_science", 100],
  ["science_basics", 100],
  ["physics_basics", 50],
  ["chemistry_basics", 50],
  ["biology_basics", 50],
  ["earth_science_basics", 50],
  ["geography", 100],
  ["geography_b", 100],
  ["japanese_history", 100],
  ["japanese_history_b", 100],
  ["world_history", 100],
  ["world_history_b", 100],
  ["integrated_history_public", 100],
  ["public_ethics", 100],
  ["public_politics_economy", 100],
  ["ethics", 100],
  ["politics_economy", 100],
  ["ethics_politics_economy", 100],
  ["modern_society", 100],
]);

for (const year of [2022, 2024, 2025]) {
  for (const [subject, expectedMax] of retakeExpectedMax.entries()) {
    updateRetakeAndPublic(year, subject, (schema) => normalizeVisibleMax(schema, expectedMax));
  }
}

function fix2025InformationExact(schema) {
  rebuildMarksheetFromRows(schema, [
    { id: "s1", title: "第1問", rows: [
      { labels: ["ア"], answers: ["2"], points: 2 },
      { labels: ["イ"], answers: ["2"], points: 2 },
      { labels: ["ウ", "エ", "オ"], answers: ["1", "2", "8"], points: 3 },
      { labels: ["カ"], answers: ["5"], points: 3 },
      { labels: ["キ"], answers: ["7"], points: 2 },
      { labels: ["ク"], answers: ["3"], points: 3 },
      { labels: ["ケ"], answers: ["2"], points: 2 },
      { labels: ["コ", "サ"], answers: ["0", "1"], points: 3 },
    ] },
    { id: "s2", title: "第2問", rows: [
      { labels: ["ア"], answers: ["5"], points: 2 },
      { labels: ["イ", "ウ"], answers: ["3", "4"], points: 2, unordered: true },
      { labels: ["エ"], answers: ["0"], points: 2 },
      { labels: ["オ", "カ"], answers: ["3", "5"], points: 3 },
      { labels: ["キ"], answers: ["0"], points: 2 },
      { labels: ["ク"], answers: ["6"], points: 2 },
      { labels: ["ケ"], answers: ["3"], points: 2 },
      { labels: ["コ"], answers: ["5"], points: 3 },
      { labels: ["サ", "シ"], answers: ["1", "2"], points: 3 },
      { labels: ["ス", "セ"], answers: ["1", "8"], points: 3 },
      { labels: ["ソ"], answers: ["1"], points: 3 },
      { labels: ["タ"], answers: ["2"], points: 3 },
    ] },
    { id: "s3", title: "第3問", rows: [
      { labels: ["ア"], answers: ["2"], points: 1 },
      { labels: ["イ"], answers: ["2"], points: 1 },
      { labels: ["ウ"], answers: ["2"], points: 2 },
      { labels: ["エ"], answers: ["3"], points: 2 },
      { labels: ["オ"], answers: ["5"], points: 2 },
      { labels: ["カ"], answers: ["4"], points: 2 },
      { labels: ["キ"], answers: ["1"], points: 3 },
      { labels: ["ク"], answers: ["1"], points: 2 },
      { labels: ["ケ"], answers: ["1"], points: 2 },
      { labels: ["コ"], answers: ["4"], points: 2 },
      { labels: ["サ"], answers: ["2"], points: 3 },
      { labels: ["シ"], answers: ["0"], points: 3 },
    ] },
    { id: "s4", title: "第4問", rows: [
      { labels: ["ア", "イ"], answers: ["3", "0"], points: 3 },
      { labels: ["ウ", "エ"], answers: ["0", "2"], points: 4, unordered: true },
      { labels: ["オ", "カ"], answers: ["1", "3"], points: 4, unordered: true },
      { labels: ["キ"], answers: ["0"], points: 2 },
      { labels: ["ク"], answers: ["3"], points: 3 },
      { labels: ["ケ"], answers: ["2"], points: 2 },
      { labels: ["コ"], answers: ["3"], points: 3 },
      { labels: ["サ"], answers: ["2"], points: 2 },
      { labels: ["シ"], answers: ["4"], points: 2 },
    ] },
  ]);
}

function fix2026InformationExact(schema) {
  rebuildMarksheetFromRows(schema, [
    { id: "s1", title: "第1問", rows: [
      { labels: ["ア", "イ"], answers: ["0", "3"], points: 2 },
      { labels: ["ウ"], answers: ["3"], points: 2 },
      { labels: ["エ", "オ"], answers: ["e", "4"], points: 2 },
      { labels: ["カ", "キ", "ク", "ケ"], answers: ["9", "6", "6", "9"], points: 4 },
      { labels: ["コ"], answers: ["0"], points: 2 },
      { labels: ["サ"], answers: ["3"], points: 2 },
      { labels: ["シ"], answers: ["5"], points: 1 },
      { labels: ["ス"], answers: ["2"], points: 2 },
      { labels: ["セ"], answers: ["2"], points: 2 },
      { labels: ["ソ"], answers: ["0"], points: 1 },
    ] },
    { id: "s2", title: "第2問", rows: [
      { labels: ["ア", "イ"], answers: ["2", "4"], points: 3, unordered: true },
      { labels: ["ウ", "エ", "オ"], answers: ["4", "8", "1"], points: 3 },
      { labels: ["カ"], answers: ["2"], points: 2 },
      { labels: ["キ"], answers: ["1"], points: 2 },
      { labels: ["ク"], answers: ["5"], points: 2 },
      { labels: ["ケ"], answers: ["2"], points: 3 },
      { labels: ["コ"], answers: ["7"], points: 1 },
      { labels: ["サ"], answers: ["3"], points: 1 },
      { labels: ["シ"], answers: ["0"], points: 3 },
      { labels: ["ス"], answers: ["2"], points: 3 },
      { labels: ["セ", "ソ"], answers: ["3", "5"], points: 2 },
      { labels: ["タ"], answers: ["0"], points: 3 },
      { labels: ["チ"], answers: ["0"], points: 2 },
    ] },
    { id: "s3", title: "第3問", rows: [
      { labels: ["ア", "イ", "ウ"], answers: ["9", "2", "4"], points: 3 },
      { labels: ["エ"], answers: ["3"], points: 1 },
      { labels: ["オ"], answers: ["0"], points: 1 },
      { labels: ["カ", "キ"], answers: ["1", "2"], points: 4, unordered: true },
      { labels: ["ク"], answers: ["5"], points: 2 },
      { labels: ["ケ"], answers: ["2"], points: 2 },
      { labels: ["コ"], answers: ["2"], points: 2 },
      { labels: ["サ"], answers: ["3"], points: 2 },
      { labels: ["シ"], answers: ["2"], points: 2 },
      { labels: ["ス"], answers: ["0"], points: 2 },
      { labels: ["セ"], answers: ["2"], points: 2 },
      { labels: ["ソ"], answers: ["5"], points: 2 },
    ] },
    { id: "s4", title: "第4問", rows: [
      { labels: ["ア"], answers: ["1"], points: 2 },
      { labels: ["イ"], answers: ["3"], points: 1 },
      { labels: ["ウ"], answers: ["2"], points: 2 },
      { labels: ["エ", "オ"], answers: ["2", "5"], points: 2 },
      { labels: ["カ"], answers: ["3"], points: 2 },
      { labels: ["キ", "ク"], answers: ["1", "4"], points: 4, unordered: true },
      { labels: ["ケ"], answers: ["2"], points: 2 },
      { labels: ["コ"], answers: ["0"], points: 2 },
      { labels: ["サ"], answers: ["3"], points: 3 },
      { labels: ["シ"], answers: ["2"], points: 3 },
      { labels: ["ス"], answers: ["1"], points: 2 },
    ] },
  ]);
}

updateMainCommonAndPublic(2025, "information_i", fix2025InformationExact);
updateMainCommonAndPublic(2026, "information_i", fix2026InformationExact);

function setAnswersByDisplayLabel(schema, answersByLabel) {
  for (const question of schema.questions ?? []) {
    const answer = answersByLabel[String(question.displayLabel ?? "")];
    if (answer == null) continue;
    question.correctAnswer = String(answer);
    for (const rule of schema.scoringRules ?? []) {
      if ((rule.questionIds ?? []).length === 1 && rule.questionIds[0] === question.id) {
        rule.acceptedVariants = [[String(answer)]];
      }
    }
  }
}

updateMainCommonAndPublic(2023, "chemistry", (schema) =>
  setAnswersByDisplayLabel(schema, { 7: "2", 8: "1", 10: "3", 11: "4", 26: "0", 28: "0" }),
);
updateMainCommonAndPublic(2023, "chemistry_basics", (schema) =>
  setAnswersByDisplayLabel(schema, { 10: "2", 12: "1", 15: "2", 16: "5", 19: "2", 20: "5" }),
);
updateMainCommonAndPublic(2023, "english", (schema) =>
  setAnswersByDisplayLabel(schema, { 18: "3", 19: "4", 20: "2", 21: "1", 32: "2", 33: "4", 34: "5", 35: "3" }),
);
updateMainCommonAndPublic(2023, "physics", (schema) =>
  setAnswersByDisplayLabel(schema, { 9: "1", 11: "0", 13: "4", 14: "8" }),
);

function fixRetake2025InformationExact(schema) {
  rebuildMarksheetFromRows(schema, [
    { id: "s1", title: "第1問", rows: [
      { labels: ["ア"], answers: ["3"], points: 2 },
      { labels: ["イ"], answers: ["2"], points: 2 },
      { labels: ["ウ"], answers: ["1"], points: 3 },
      { labels: ["エ"], answers: ["2"], points: 3 },
      { labels: ["オ", "カ"], answers: ["0", "3"], points: 2 },
      { labels: ["キ", "ク"], answers: ["1", "4"], points: 3 },
      { labels: ["ケ"], answers: ["2"], points: 2 },
      { labels: ["コ"], answers: ["1"], points: 3 },
    ] },
    { id: "s2", title: "第2問", rows: [
      { labels: ["ア"], answers: ["8"], points: 2 },
      { labels: ["イ"], answers: ["7"], points: 2 },
      { labels: ["ウ"], answers: ["2"], points: 2 },
      { labels: ["エ"], answers: ["0"], points: 2 },
      { labels: ["オ"], answers: ["3"], points: 2 },
      { labels: ["カ"], answers: ["2"], points: 2 },
      { labels: ["キ"], answers: ["1"], points: 3 },
      { labels: ["ク"], answers: ["2"], points: 2 },
      { labels: ["ケ"], answers: ["2"], points: 2 },
      { labels: ["コ"], answers: ["4"], points: 2 },
      { labels: ["サ"], answers: ["2"], points: 2 },
      { labels: ["シ"], answers: ["2"], points: 2 },
      { labels: ["ス", "セ"], answers: ["1", "3"], points: 3 },
      { labels: ["ソ"], answers: ["6"], points: 2 },
    ] },
    { id: "s3", title: "第3問", rows: [
      { labels: ["ア"], answers: ["5"], points: 2 },
      { labels: ["イ"], answers: ["8"], points: 2 },
      { labels: ["ウ"], answers: ["4"], points: 1 },
      { labels: ["エ"], answers: ["0"], points: 2 },
      { labels: ["オ"], answers: ["3"], points: 2 },
      { labels: ["カ"], answers: ["5"], points: 2 },
      { labels: ["キ"], answers: ["6"], points: 2 },
      { labels: ["ク"], answers: ["1"], points: 1 },
      { labels: ["ケ"], answers: ["0"], points: 3 },
      { labels: ["コ"], answers: ["4"], points: 2 },
      { labels: ["サ"], answers: ["c"], points: 2 },
      { labels: ["シ"], answers: ["8"], points: 2 },
      { labels: ["ス"], answers: ["b"], points: 2 },
    ] },
    { id: "s4", title: "第4問", rows: [
      { labels: ["ア"], answers: ["1"], points: 2 },
      { labels: ["イ"], answers: ["2"], points: 3 },
      { labels: ["ウ"], answers: ["0"], points: 3 },
      { labels: ["エ"], answers: ["2"], points: 3 },
      { labels: ["オ"], answers: ["3"], points: 3 },
      { labels: ["カ"], answers: ["2"], points: 2 },
      { labels: ["キ"], answers: ["3"], points: 3 },
      { labels: ["ク"], answers: ["1"], points: 3 },
      { labels: ["ケ"], answers: ["2"], points: 3 },
    ] },
  ]);
}

updateRetakeAndPublic(2025, "information_i", fixRetake2025InformationExact);

function fixRetake2025MathIaExact(schema) {
  rebuildMarksheetFromRows(schema, [
    { id: "s1", title: "第1問", rows: [
      { labels: ["ア", "イ", "ウ"], answers: ["8", "4", "6"], points: 2 },
      { labels: ["エ", "オ", "カ"], answers: ["1", "1", "2"], points: 3 },
      { labels: ["キ"], answers: ["5"], points: 2 },
      { labels: ["ク", "ケ", "コ", "サ", "シ"], answers: ["5", "6", "8", "1", "1"], points: 3 },
      { labels: ["ス"], answers: ["7"], points: 2 },
      { labels: ["セ", "ソ"], answers: ["3", "7"], points: 3 },
      { labels: ["タ", "チ", "ツ", "テ"], answers: ["5", "7", "1", "4"], points: 3 },
      { labels: ["ト"], answers: ["2"], points: 3 },
      { labels: ["ナ"], answers: ["4"], points: 3 },
      { labels: ["ニ", "ヌ", "ネ"], answers: ["2", "5", "0"], points: 3 },
      { labels: ["ノ"], answers: ["6"], points: 3 },
    ] },
    { id: "s2", title: "第2問", rows: [
      { labels: ["ア", "イ", "ウ", "エ"], answers: ["7", "4", "7", "8"], points: 3 },
      { labels: ["オ", "カ", "キ", "ク"], answers: ["1", "4", "1", "3"], points: 3 },
      { labels: ["ケ"], answers: ["2"], points: 3 },
      { labels: ["コ", "サ"], answers: ["1", "2"], points: 2 },
      { labels: ["シ"], answers: ["2"], points: 4 },
      { labels: ["ス"], answers: ["1"], points: 2 },
      { labels: ["セ"], answers: ["2"], points: 2 },
      { labels: ["ソ"], answers: ["0"], points: 2 },
      { labels: ["タ"], answers: ["7"], points: 2 },
      { labels: ["チ"], answers: ["5"], points: 2 },
      { labels: ["ツ"], answers: ["3"], points: 2 },
      { labels: ["テ", "ト"], answers: ["6", "2"], points: 3 },
    ] },
    { id: "s3", title: "第3問", rows: [
      { labels: ["ア"], answers: ["1"], points: 2 },
      { labels: ["イ", "ウ", "エ", "オ"], answers: ["9", "0", "1", "0"], points: 3 },
      { labels: ["カ", "キ"], answers: ["2", "1"], points: 3 },
      { labels: ["ク", "ケ"], answers: ["3", "2"], points: 3 },
      { labels: ["コ", "サ"], answers: ["1", "0"], points: 3 },
      { labels: ["シ", "ス"], answers: ["7", "0"], points: 3 },
      { labels: ["セ"], answers: ["0"], points: 3 },
    ] },
    { id: "s4", title: "第4問", rows: [
      { labels: ["ア", "イ"], answers: ["1", "5"], points: 2 },
      { labels: ["ウ", "エ", "オ"], answers: ["1", "1", "5"], points: 3 },
      { labels: ["カ", "キ"], answers: ["2", "5"], points: 3 },
      { labels: ["ク", "ケ", "コ", "サ"], answers: ["5", "1", "0", "8"], points: 3 },
      { labels: ["シ", "ス", "セ", "ソ", "タ"], answers: ["2", "5", "2", "1", "6"], points: 3 },
      { labels: ["チ", "ツ", "テ", "ト"], answers: ["3", "5", "7", "2"], points: 3 },
      { labels: ["ナ", "ニ"], answers: ["1", "0"], points: 3 },
    ] },
  ]);
}

function fixRetake2025MathIibcExact(schema) {
  rebuildMarksheetFromRows(schema, [
    { id: "s1", title: "第1問", rows: [
      { labels: ["ア"], answers: ["4"], points: 2 },
      { labels: ["イ"], answers: ["5"], points: 2 },
      { labels: ["ウ"], answers: ["8"], points: 2 },
      { labels: ["エ"], answers: ["4"], points: 2 },
      { labels: ["オ"], answers: ["0"], points: 2 },
      { labels: ["カ", "キ"], answers: ["4", "3"], points: 2 },
      { labels: ["ク", "ケ"], answers: ["8", "7"], points: 3 },
    ] },
    { id: "s2", title: "第2問", rows: [
      { labels: ["ア", "イ", "ウ"], answers: ["3", "6", "6"], points: 3 },
      { labels: ["エ"], answers: ["0"], points: 2 },
      { labels: ["オ", "カ"], answers: ["1", "2"], points: 2 },
      { labels: ["キ"], answers: ["1"], points: 2 },
      { labels: ["ク"], answers: ["2"], points: 3 },
      { labels: ["ケ"], answers: ["1"], points: 1 },
      { labels: ["コ", "サ", "シ", "ス", "セ", "ソ"], answers: ["2", "3", "2", "2", "3", "3"], points: 2 },
    ] },
    { id: "s3", title: "第3問", rows: [
      { labels: ["ア"], answers: ["2"], points: 2 },
      { labels: ["イ", "ウ"], answers: ["0", "0"], points: 2 },
      { labels: ["エ", "オ", "カ", "キ"], answers: ["2", "-", "4", "3"], points: 2 },
      { labels: ["ク", "ケ"], answers: ["2", "0"], points: 2 },
      { labels: ["コ", "サ"], answers: ["2", "9"], points: 2 },
      { labels: ["シ", "ス"], answers: ["0", "2"], points: 3 },
      { labels: ["セ"], answers: ["2"], points: 3 },
      { labels: ["ソ"], answers: ["3"], points: 3 },
      { labels: ["タ"], answers: ["2"], points: 3 },
    ] },
    { id: "s4", title: "第4問", rows: [
      { labels: ["ア", "イ", "ウ", "エ", "オ"], answers: ["-", "3", "-", "1", "2"], points: 2 },
      { labels: ["カ", "キ"], answers: ["0", "2"], points: 2 },
      { labels: ["ク"], answers: ["6"], points: 1 },
      { labels: ["ケ", "コ", "サ", "シ", "ス"], answers: ["3", "-", "1", "2", "6"], points: 2 },
      { labels: ["セ"], answers: ["1"], points: 2 },
      { labels: ["ソ"], answers: ["0"], points: 2 },
      { labels: ["タ", "チ"], answers: ["0", "4"], points: 2 },
      { labels: ["ツ"], answers: ["5"], points: 3 },
    ] },
    { id: "s5", title: "第5問", rows: [
      { labels: ["ア"], answers: ["1"], points: 1 },
      { labels: ["イ", "ウ", "エ"], answers: ["8", "8", "9"], points: 1 },
      { labels: ["オ", "カ"], answers: ["2", "0"], points: 1 },
      { labels: ["キ", "ク"], answers: ["2", "5"], points: 1 },
      { labels: ["ケ"], answers: ["1"], points: 1 },
      { labels: ["コ"], answers: ["0"], points: 2 },
      { labels: ["サ"], answers: ["5"], points: 2 },
      { labels: ["シ"], answers: ["0"], points: 3 },
      { labels: ["ス"], answers: ["1"], points: 1 },
      { labels: ["セ"], answers: ["2"], points: 3 },
    ] },
    { id: "s6", title: "第6問", rows: [
      { labels: ["ア"], answers: ["3"], points: 2 },
      { labels: ["イ", "ウ", "エ"], answers: ["3", "1", "5"], points: 2 },
      { labels: ["オ", "カ", "キ", "ク"], answers: ["-", "1", "-", "2"], points: 2 },
      { labels: ["ケ", "コ", "サ", "シ"], answers: ["0", "3", "-", "1"], points: 2 },
      { labels: ["ス"], answers: ["7"], points: 1 },
      { labels: ["セ", "ソ", "タ", "チ"], answers: ["-", "1", "2", "0"], points: 2 },
      { labels: ["ツ", "テ", "ト", "ナ", "ニ"], answers: ["1", "0", "-", "1", "0"], points: 1 },
      { labels: ["ヌ", "ネ"], answers: ["0", "3"], points: 2 },
      { labels: ["ノ", "ハ", "ヒ"], answers: ["0", "1", "1"], points: 2 },
    ] },
    { id: "s7", title: "第7問", rows: [
      { labels: ["ア"], answers: ["1"], points: 2 },
      { labels: ["イ", "ウ"], answers: ["4", "2"], points: 1 },
      { labels: ["エ"], answers: ["3"], points: 1 },
      { labels: ["オ"], answers: ["1"], points: 2 },
      { labels: ["カ"], answers: ["2"], points: 2 },
      { labels: ["キ"], answers: ["7"], points: 2 },
      { labels: ["ク"], answers: ["4"], points: 3 },
      { labels: ["ケ"], answers: ["5"], points: 3 },
    ] },
  ]);
  schema.selectionGroups = [{ title: "第4問〜第7問から3問選択", sectionIds: ["s4", "s5", "s6", "s7"], maxSelect: 3 }];
}

updateRetakeAndPublic(2025, "math_ia", fixRetake2025MathIaExact);
updateRetakeAndPublic(2025, "math_iibc", fixRetake2025MathIibcExact);

function addSingleQuestionPartialByLabel(schema, label, partialAnswers, points) {
  const question = (schema.questions ?? []).find((item) => String(item.displayLabel) === String(label));
  if (!question) return;
  const rule = (schema.scoringRules ?? []).find((item) => (item.questionIds ?? []).includes(question.id));
  if (!rule) return;
  rule.partialCredit = [
    {
      acceptedVariants: partialAnswers.map((answer) => [String(answer)]),
      points,
    },
  ];
}

function fixRetake2023BiologyExact(schema) {
  rebuildMarksheetFromRows(schema, [
    { id: "s1", title: "第1問", rows: [
      { labels: ["1"], answers: ["5"], points: 4 },
      { labels: ["2"], answers: ["4"], points: 4 },
      { labels: ["3"], answers: ["1"], points: 4 },
    ] },
    { id: "s2", title: "第2問", rows: [
      { labels: ["4"], answers: ["2"], points: 4 },
      { labels: ["5"], answers: ["4"], points: 4 },
      { labels: ["6"], answers: ["6"], points: 4 },
    ] },
    { id: "s3", title: "第3問", rows: [
      { labels: ["7"], answers: ["8"], points: 5 },
      { labels: ["8"], answers: ["1"], points: 4 },
      { labels: ["9"], answers: ["2"], points: 2 },
      { labels: ["10"], answers: ["a"], points: 3 },
      { labels: ["11"], answers: ["4"], points: 4 },
      { labels: ["12"], answers: ["6"], points: 4 },
    ] },
    { id: "s4", title: "第4問", rows: [
      { labels: ["13"], answers: ["5"], points: 4 },
      { labels: ["14"], answers: ["4"], points: 4 },
      { labels: ["15"], answers: ["7"], points: 4 },
      { labels: ["16"], answers: ["6"], points: 4 },
      { labels: ["17"], answers: ["2"], points: 4 },
    ] },
    { id: "s5", title: "第5問", rows: [
      { labels: ["18", "19"], answers: ["1", "5"], points: 4, unordered: true },
      { labels: ["20"], answers: ["3"], points: 4 },
      { labels: ["21"], answers: ["9"], points: 4 },
      { labels: ["22"], answers: ["8"], points: 4 },
      { labels: ["23"], answers: ["6"], points: 5 },
    ] },
    { id: "s6", title: "第6問", rows: [
      { labels: ["24"], answers: ["6"], points: 4 },
      { labels: ["25"], answers: ["2"], points: 4 },
      { labels: ["26"], answers: ["3"], points: 5 },
    ] },
  ]);
  addSingleQuestionPartialByLabel(schema, "7", ["2", "3"], 2);
  addSingleQuestionPartialByLabel(schema, "12", ["2", "3"], 1);
  addSingleQuestionPartialByLabel(schema, "16", ["8"], 2);
  addSingleQuestionPartialByLabel(schema, "23", ["2", "3"], 2);
  addSingleQuestionPartialByLabel(schema, "26", ["1", "2", "6", "9"], 1);
}

function fixRetakeChemistryGroups(schema, groups) {
  for (const group of groups) {
    const questionIds = group.labels
      .map((label) => (schema.questions ?? []).find((question) => String(question.displayLabel) === String(label))?.id)
      .filter(Boolean);
    if (questionIds.length === group.labels.length) {
      setCompositeRule(schema, questionIds, {
        id: group.id,
        ...(group.points ? { points: group.points } : {}),
        orderMatters: group.orderMatters ?? true,
      });
    }
  }
}

updateRetakeAndPublic(2023, "biology", fixRetake2023BiologyExact);

function fixRetake2023BiologyBasicsExact(schema) {
  rebuildMarksheetFromRows(schema, [
    { id: "s1", title: sectionTitle(1), rows: [
      { labels: ["1"], answers: ["3"], points: 3 },
      { labels: ["2"], answers: ["1"], points: 4, partialCredit: [{ acceptedVariants: [["2"]], points: 2 }] },
      { labels: ["3"], answers: ["3"], points: 3 },
      { labels: ["4"], answers: ["3"], points: 3 },
      { labels: ["5"], answers: ["2"], points: 3 },
    ] },
    { id: "s2", title: sectionTitle(2), rows: [
      { labels: ["6"], answers: ["4"], points: 3 },
      { labels: ["7", "8"], answers: ["1", "4"], points: 4, unordered: true },
      { labels: ["9"], answers: ["3"], points: 3 },
      { labels: ["10"], answers: ["3"], points: 2 },
      { labels: ["11"], answers: ["6"], points: 3 },
      { labels: ["12"], answers: ["2"], points: 3 },
    ] },
    { id: "s3", title: sectionTitle(3), rows: [
      { labels: ["13"], answers: ["6"], points: 3 },
      { labels: ["14"], answers: ["5"], points: 3 },
      { labels: ["15"], answers: ["4"], points: 3 },
      { labels: ["16", "17"], answers: ["1", "5"], points: 4, unordered: true },
      { labels: ["18"], answers: ["6"], points: 3 },
    ] },
  ]);
  normalizeVisibleMax(schema, 50);
}

function fixRetake2023EarthScienceBasicsExact(schema) {
  rebuildMarksheetFromRows(schema, [
    { id: "s1", title: sectionTitle(1), rows: [
      { labels: ["1"], answers: ["4"], points: 3 },
      { labels: ["2"], answers: ["4"], points: 3 },
      { labels: ["3"], answers: ["2"], points: 4 },
      { labels: ["4"], answers: ["3"], points: 3 },
      { labels: ["5"], answers: ["2"], points: 3 },
      { labels: ["6", "7"], answers: ["2", "4"], points: 4, unordered: true },
      { labels: ["8"], answers: ["1"], points: 3 },
    ] },
    { id: "s2", title: sectionTitle(2), rows: [
      { labels: ["9"], answers: ["3"], points: 4 },
      { labels: ["10"], answers: ["1"], points: 3 },
    ] },
    { id: "s3", title: sectionTitle(3), rows: [
      { labels: ["11"], answers: ["4"], points: 3 },
      { labels: ["12"], answers: ["4"], points: 3 },
      { labels: ["13"], answers: ["2"], points: 4 },
    ] },
    { id: "s4", title: sectionTitle(4), rows: [
      { labels: ["14"], answers: ["1"], points: 3 },
      { labels: ["15"], answers: ["3"], points: 3 },
      { labels: ["16"], answers: ["3"], points: 4 },
    ] },
  ]);
  normalizeVisibleMax(schema, 50);
}

updateRetakeAndPublic(2023, "biology_basics", fixRetake2023BiologyBasicsExact);
updateRetakeAndPublic(2023, "earth_science_basics", fixRetake2023EarthScienceBasicsExact);
updateRetakeAndPublic(2023, "chemistry", (schema) => {
  fixRetakeChemistryGroups(schema, [
    { labels: ["16", "17"], id: "rule_16_17_all_or_nothing", points: 4 },
    { labels: ["28", "29", "30"], id: "rule_28_30_all_or_nothing", points: 4 },
    { labels: ["13", "14"], id: "rule_13_14_unordered", points: 4, orderMatters: false },
  ]);
  normalizeVisibleMax(schema, 100);
});
updateRetakeAndPublic(2025, "chemistry", (schema) => {
  fixRetakeChemistryGroups(schema, [{ labels: ["20", "21"], id: "rule_20_21_all_or_nothing", points: 3 }]);
  normalizeVisibleMax(schema, 100);
});

function fixRetake2025ScienceBasicsExact(schema) {
  rebuildMarksheetFromRows(schema, [
    { id: "physics_basics", title: "\u7269\u7406\u57fa\u790e", rows: [
      { labels: ["101"], answers: ["5"], points: 4 },
      { labels: ["102"], answers: ["6"], points: 4 },
      { labels: ["103"], answers: ["1"], points: 2 },
      { labels: ["104"], answers: ["3"], points: 2 },
      { labels: ["105"], answers: ["3"], points: 4 },
      { labels: ["106"], answers: ["3"], points: 3 },
      { labels: ["107"], answers: ["2"], points: 4 },
      { labels: ["108"], answers: ["6"], points: 3 },
      { labels: ["109"], answers: ["1"], points: 3 },
      { labels: ["110"], answers: ["1"], points: 3 },
      { labels: ["111"], answers: ["4"], points: 3 },
      { labels: ["112"], answers: ["6"], points: 4 },
      { labels: ["113"], answers: ["1"], points: 4 },
      { labels: ["114"], answers: ["5"], points: 4 },
      { labels: ["115"], answers: ["5"], points: 3 },
    ] },
    { id: "chemistry_basics", title: "\u5316\u5b66\u57fa\u790e", rows: [
      { labels: ["101"], answers: ["4"], points: 3 },
      { labels: ["102"], answers: ["2"], points: 3 },
      { labels: ["103"], answers: ["2"], points: 3 },
      { labels: ["104"], answers: ["1"], points: 3 },
      { labels: ["105"], answers: ["4"], points: 3 },
      { labels: ["106"], answers: ["5"], points: 3 },
      { labels: ["107"], answers: ["1"], points: 3 },
      { labels: ["108"], answers: ["2"], points: 3 },
      { labels: ["109"], answers: ["3"], points: 3 },
      { labels: ["110"], answers: ["5"], points: 3 },
      { labels: ["111"], answers: ["3"], points: 2 },
      { labels: ["112"], answers: ["4"], points: 3 },
      { labels: ["113"], answers: ["1"], points: 3 },
      { labels: ["114"], answers: ["3"], points: 3 },
      { labels: ["115"], answers: ["1"], points: 3 },
      { labels: ["116", "117", "118"], answers: ["2", "0", "3"], points: 3 },
      { labels: ["119"], answers: ["6"], points: 3 },
    ] },
    { id: "biology_basics", title: "\u751f\u7269\u57fa\u790e", rows: [
      { labels: ["101"], answers: ["6"], points: 3 },
      { labels: ["102"], answers: ["1"], points: 3 },
      { labels: ["103"], answers: ["3"], points: 3 },
      { labels: ["104"], answers: ["4"], points: 3 },
      { labels: ["105"], answers: ["4"], points: 2 },
      { labels: ["106"], answers: ["5"], points: 3 },
      { labels: ["107"], answers: ["2"], points: 2 },
      { labels: ["108"], answers: ["1"], points: 3 },
      { labels: ["109"], answers: ["5"], points: 3 },
      { labels: ["110"], answers: ["3"], points: 3 },
      { labels: ["111"], answers: ["8"], points: 3 },
      { labels: ["112"], answers: ["4"], points: 3 },
      { labels: ["113", "114"], answers: ["1", "4"], points: 6, unordered: true },
      { labels: ["115"], answers: ["2"], points: 2 },
      { labels: ["116"], answers: ["3"], points: 4 },
      { labels: ["117"], answers: ["4"], points: 4 },
    ] },
    { id: "earth_science_basics", title: "\u5730\u5b66\u57fa\u790e", rows: [
      { labels: ["101"], answers: ["4"], points: 3 },
      { labels: ["102"], answers: ["1"], points: 4 },
      { labels: ["103"], answers: ["3"], points: 3 },
      { labels: ["104"], answers: ["2"], points: 3 },
      { labels: ["105"], answers: ["5"], points: 4 },
      { labels: ["106"], answers: ["4"], points: 3 },
      { labels: ["107"], answers: ["3"], points: 3 },
      { labels: ["108"], answers: ["4"], points: 4 },
      { labels: ["109"], answers: ["1"], points: 3 },
      { labels: ["110"], answers: ["5"], points: 4 },
      { labels: ["111"], answers: ["6"], points: 3 },
      { labels: ["112"], answers: ["5"], points: 3 },
      { labels: ["113"], answers: ["1"], points: 3 },
      { labels: ["114"], answers: ["1"], points: 4 },
      { labels: ["115"], answers: ["4"], points: 3 },
    ] },
  ]);
  schema.selectionGroups = [{
    id: "science_basics_select_two",
    title: "4\u79d1\u76ee\u304b\u30892\u79d1\u76ee\u9078\u629e",
    sectionIds: ["physics_basics", "chemistry_basics", "biology_basics", "earth_science_basics"],
    minSelect: 2,
    maxSelect: 2,
  }];
  normalizeVisibleMax(schema, 100);
}

updateRetakeAndPublic(2025, "science_basics", fixRetake2025ScienceBasicsExact);

function fixRetake2023PhysicsExact(schema) {
  rebuildMarksheetFromRows(schema, [
    { id: "s1", title: "第1問", rows: [
      { labels: ["1"], answers: ["5"], points: 5 },
      { labels: ["2"], answers: ["8"], points: 5 },
      { labels: ["3"], answers: ["5"], points: 5 },
      { labels: ["4"], answers: ["5"], points: 5 },
      { labels: ["5"], answers: ["4"], points: 5 },
    ] },
    { id: "s2", title: "第2問", rows: [
      { labels: ["6"], answers: ["6"], points: 5 },
      { labels: ["7"], answers: ["2"], points: 5 },
      { labels: ["8"], answers: ["3"], points: 5 },
      { labels: ["9"], answers: ["2"], points: 5 },
      { labels: ["10"], answers: ["3"], points: 5 },
    ] },
    { id: "s3", title: "第3問", rows: [
      { labels: ["11"], answers: ["1"], points: 5 },
      { labels: ["12"], answers: ["3"], points: 5 },
      { labels: ["13"], answers: ["4"], points: 5 },
      { labels: ["14"], answers: ["4"], points: 5 },
    ] },
    { id: "s4", title: "第4問", rows: [
      { labels: ["15"], answers: ["6"], points: 5 },
      { labels: ["16"], answers: ["5"], points: 5 },
      { labels: ["17"], answers: ["2"], points: 5 },
      { labels: ["18"], answers: ["4"], points: 5 },
      { labels: ["19"], answers: ["3"], points: 5 },
      { labels: ["20"], answers: ["5"], points: 5 },
    ] },
  ]);
  addSingleQuestionPartialByLabel(schema, "6", ["3", "4", "5", "9"], 1);
  addSingleQuestionPartialByLabel(schema, "7", ["1", "3", "5", "8"], 1);
  addSingleQuestionPartialByLabel(schema, "11", ["2", "3", "5"], 1);
  addSingleQuestionPartialByLabel(schema, "12", ["1", "4", "5"], 1);
}

updateRetakeAndPublic(2023, "physics", fixRetake2023PhysicsExact);

function fixRetake2023EnglishMissingGroups(schema) {
  const setAnswer = (label, answer) => {
    const question = (schema.questions ?? []).find((item) => String(item.displayLabel) === String(label));
    if (question) question.correctAnswer = String(answer);
  };
  setAnswer("35", "1");
  setAnswer("36", "3");
  setAnswer("46", "1");
  setAnswer("47", "4");

  const byLabel = (label) => (schema.questions ?? []).find((item) => String(item.displayLabel) === String(label))?.id;
  const setByLabels = (labels, options) => {
    const ids = labels.map(byLabel).filter(Boolean);
    if (ids.length === labels.length) setCompositeRule(schema, ids, options);
  };
  setByLabels(["35", "36"], {
    id: "rule_35_36_all_or_nothing",
    title: "解答番号 35-36（全部正解のみ）",
    points: 3,
    orderMatters: false,
  });
  setByLabels(["46", "47"], {
    id: "rule_46_47_all_or_nothing",
    title: "解答番号 46-47（全部正解のみ）",
    points: 3,
    orderMatters: false,
  });
  normalizeVisibleMax(schema, 100);
}

updateRetakeAndPublic(2023, "english", fixRetake2023EnglishMissingGroups);

function fixRetakeListeningMissingAllOrNothing(schema) {
  for (const group of [
    { labels: ["28", "29"], id: "rule_28_29_all_or_nothing", points: 2 },
    { labels: ["30", "31"], id: "rule_30_31_all_or_nothing", points: 2 },
  ]) {
    const ids = group.labels
      .map((label) => (schema.questions ?? []).find((question) => String(question.displayLabel) === String(label))?.id)
      .filter(Boolean);
    if (ids.length === group.labels.length) {
      setCompositeRule(schema, ids, {
        id: group.id,
        title: `解答番号 ${group.labels.join("-")}（全部正解のみ）`,
        points: group.points,
      });
    }
  }
}

updateRetakeAndPublic(2024, "english_listening", fixRetakeListeningMissingAllOrNothing);

function setRetakeEnglishAnswers(schema, answersByLabel) {
  for (const [label, answer] of Object.entries(answersByLabel)) {
    const question = (schema.questions ?? []).find((item) => String(item.displayLabel) === String(label));
    if (question) question.correctAnswer = String(answer);
  }
}

function setRetakeCompositeByLabels(schema, labels, options) {
  const ids = labels
    .map((label) => (schema.questions ?? []).find((question) => String(question.displayLabel) === String(label))?.id)
    .filter(Boolean);
  if (ids.length === labels.length) setCompositeRule(schema, ids, options);
}

function fixRetake2024EnglishReadingHyphenGroups(schema) {
  rebuildMarksheetFromRows(schema, [
    { id: "s1", title: sectionTitle(1), rows: [
      { labels: ["1"], answers: ["2"], points: 2 },
      { labels: ["2"], answers: ["4"], points: 2 },
      { labels: ["3"], answers: ["1"], points: 2 },
      { labels: ["4"], answers: ["3"], points: 2 },
      { labels: ["5"], answers: ["2"], points: 2 },
    ] },
    { id: "s2", title: sectionTitle(2), rows: [
      { labels: ["6"], answers: ["1"], points: 2 },
      { labels: ["7"], answers: ["2"], points: 2 },
      { labels: ["8"], answers: ["4"], points: 2 },
      { labels: ["9", "10", "11", "12"], answers: ["3", "4", "2", "4"], points: 8, unordered: true },
      { labels: ["13"], answers: ["3"], points: 2 },
      { labels: ["14"], answers: ["2"], points: 2 },
      { labels: ["15"], answers: ["3"], points: 2 },
    ] },
    { id: "s3", title: sectionTitle(3), rows: [
      { labels: ["16"], answers: ["1"], points: 3 },
      { labels: ["17"], answers: ["4"], points: 3 },
      { labels: ["18", "19", "20", "21"], answers: ["3", "5", "6", "7"], points: 3 },
      { labels: ["22", "23", "24", "25"], answers: ["3", "2", "2", "1"], points: 12, unordered: true },
    ] },
    { id: "s4", title: sectionTitle(4), rows: [
      { labels: ["26"], answers: ["2"], points: 3 },
      { labels: ["27"], answers: ["2"], points: 2 },
      { labels: ["28"], answers: ["1"], points: 2 },
      { labels: ["29"], answers: ["4"], points: 3 },
    ] },
    { id: "s5", title: sectionTitle(5), rows: [
      { labels: ["30", "31"], answers: ["1", "4"], points: 3, unordered: true },
      { labels: ["32", "33", "34", "35"], answers: ["5", "3", "1", "4"], points: 3 },
      { labels: ["36"], answers: ["2"], points: 3 },
      { labels: ["37"], answers: ["3"], points: 3 },
      { labels: ["38"], answers: ["3"], points: 3 },
    ] },
    { id: "s6", title: sectionTitle(6), rows: [
      { labels: ["39"], answers: ["2"], points: 3 },
      { labels: ["40", "41"], answers: ["2", "4"], points: 3 },
      { labels: ["42"], answers: ["1"], points: 3 },
      { labels: ["43"], answers: ["2"], points: 3 },
      { labels: ["44"], answers: ["3"], points: 2 },
      { labels: ["45"], answers: ["3"], points: 2 },
      { labels: ["46", "47"], answers: ["2", "4"], points: 3 },
      { labels: ["48"], answers: ["1"], points: 3 },
      { labels: ["49"], answers: ["3"], points: 2 },
    ] },
  ]);
  for (const label of ["9", "10", "11", "12", "22", "23", "24", "25"]) {
    setSingleRule(schema, `q_${label}`, { points: ["22", "23", "24", "25"].includes(label) ? 3 : 2 });
  }
  setCompositeRule(schema, ["q_30", "q_31"], { id: "rule_30_31_unordered", points: 3, orderMatters: false });
  setCompositeRule(schema, ["q_40", "q_41"], { id: "rule_40_41_unordered", points: 3, orderMatters: false });
  setCompositeRule(schema, ["q_46", "q_47"], { id: "rule_46_47_unordered", points: 3, orderMatters: false });
  normalizeVisibleMax(schema, 100);

}

function fixRetake2025EnglishReadingHyphenGroups(schema) {
  setRetakeEnglishAnswers(schema, {
    21: "1",
    22: "4",
    36: "3",
    37: "4",
    40: "1",
    41: "4",
    42: "3",
  });
  setRetakeCompositeByLabels(schema, ["21", "22"], {
    id: "rule_21_22_unordered",
    title: "解答番号 21-22（順不同）",
    points: 4,
    orderMatters: false,
  });
  setRetakeCompositeByLabels(schema, ["36", "37"], {
    id: "rule_36_37_all_or_nothing",
    title: "解答番号 36-37（全部正解のみ）",
    points: 4,
    orderMatters: false,
  });
  setRetakeCompositeByLabels(schema, ["40", "41"], {
    id: "rule_40_41_all_or_nothing",
    title: "解答番号 40-41（全部正解のみ）",
    points: 4,
    orderMatters: false,
  });
  setSingleRule(schema, "q_42", { points: 1, answer: "3", id: "rule_42" });
  normalizeVisibleMax(schema, 100);
}

updateRetakeAndPublic(2024, "english", fixRetake2024EnglishReadingHyphenGroups);
updateRetakeAndPublic(2025, "english", fixRetake2025EnglishReadingHyphenGroups);

function fixRetake2024BiologyExact(schema) {
  rebuildMarksheetFromRows(schema, [
    { id: "s1", title: sectionTitle(1), rows: [
      { labels: ["1"], answers: ["5"], points: 3 },
      { labels: ["2"], answers: ["3"], points: 3 },
      { labels: ["3"], answers: ["2"], points: 4 },
      { labels: ["4"], answers: ["1"], points: 5 },
    ] },
    { id: "s2", title: sectionTitle(2), rows: [
      { labels: ["5"], answers: ["4"], points: 5, partialCredit: [{ acceptedVariants: [["6"]], points: 2 }] },
      { labels: ["6"], answers: ["3"], points: 5 },
      { labels: ["7"], answers: ["5"], points: 5 },
    ] },
    { id: "s3", title: sectionTitle(3), rows: [
      { labels: ["8", "9"], answers: ["5", "6"], points: 6, unordered: true },
      { labels: ["10"], answers: ["1"], points: 4 },
      { labels: ["11"], answers: ["1"], points: 4 },
      { labels: ["12"], answers: ["2"], points: 4 },
    ] },
    { id: "s4", title: sectionTitle(4), rows: [
      { labels: ["13"], answers: ["5"], points: 5 },
      { labels: ["14"], answers: ["1"], points: 4 },
      { labels: ["15"], answers: ["3"], points: 5 },
      { labels: ["16"], answers: ["3"], points: 5 },
    ] },
    { id: "s5", title: sectionTitle(5), rows: [
      { labels: ["17"], answers: ["1"], points: 4 },
      { labels: ["18", "19"], answers: ["2", "5"], points: 6, unordered: true },
      { labels: ["20"], answers: ["3"], points: 4 },
    ] },
    { id: "s6", title: sectionTitle(6), rows: [
      { labels: ["21"], answers: ["2"], points: 3 },
      { labels: ["22"], answers: ["9"], points: 3 },
      { labels: ["23"], answers: ["3"], points: 4 },
      { labels: ["24"], answers: ["3"], points: 4 },
      { labels: ["25"], answers: ["1"], points: 5 },
    ] },
  ]);
  normalizeVisibleMax(schema, 100);
}

function fixRetake2024BiologyBasicsExact(schema) {
  rebuildMarksheetFromRows(schema, [
    { id: "s1", title: sectionTitle(1), rows: [
      { labels: ["1"], answers: ["1"], points: 3 },
      { labels: ["2"], answers: ["4"], points: 3 },
      { labels: ["3"], answers: ["3"], points: 3 },
      { labels: ["4"], answers: ["4"], points: 3 },
      { labels: ["5"], answers: ["2"], points: 3 },
      { labels: ["6"], answers: ["4"], points: 3 },
    ] },
    { id: "s2", title: sectionTitle(2), rows: [
      { labels: ["7"], answers: ["5"], points: 2 },
      { labels: ["8"], answers: ["3"], points: 2 },
      { labels: ["9"], answers: ["4"], points: 3 },
      { labels: ["10"], answers: ["2"], points: 3 },
      { labels: ["11"], answers: ["1"], points: 3 },
      { labels: ["12"], answers: ["2"], points: 3 },
    ] },
    { id: "s3", title: sectionTitle(3), rows: [
      { labels: ["13", "14"], answers: ["1", "5"], points: 6, unordered: true },
      { labels: ["15"], answers: ["2"], points: 3 },
      { labels: ["16", "17"], answers: ["1", "5"], points: 4, unordered: true },
      { labels: ["18"], answers: ["8"], points: 3 },
    ] },
  ]);
  normalizeVisibleMax(schema, 50);
}

function fixRetake2024JapaneseExact(schema) {
  rebuildMarksheetFromRows(schema, [
    { id: "s1", title: sectionTitle(1), rows: [
      { labels: ["1"], answers: ["3"], points: 2 },
      { labels: ["2"], answers: ["3"], points: 2 },
      { labels: ["3"], answers: ["1"], points: 2 },
      { labels: ["4"], answers: ["2"], points: 2 },
      { labels: ["5"], answers: ["4"], points: 2 },
      { labels: ["6"], answers: ["3"], points: 7 },
      { labels: ["7"], answers: ["3"], points: 7 },
      { labels: ["8"], answers: ["4"], points: 7 },
      { labels: ["9"], answers: ["2"], points: 7 },
      { labels: ["10"], answers: ["1"], points: 4 },
      { labels: ["11"], answers: ["4"], points: 4 },
      { labels: ["12"], answers: ["3"], points: 4 },
    ] },
    { id: "s2", title: sectionTitle(2), rows: [
      { labels: ["13"], answers: ["4"], points: 4 },
      { labels: ["14"], answers: ["2"], points: 5 },
      { labels: ["15"], answers: ["2"], points: 6 },
      { labels: ["16"], answers: ["5"], points: 7 },
      { labels: ["17"], answers: ["3"], points: 7 },
      { labels: ["18"], answers: ["4"], points: 6 },
      { labels: ["19"], answers: ["5"], points: 5 },
      { labels: ["20"], answers: ["4"], points: 5 },
      { labels: ["21"], answers: ["3"], points: 5 },
    ] },
    { id: "s3", title: sectionTitle(3), rows: [
      { labels: ["22"], answers: ["4"], points: 5 },
      { labels: ["23"], answers: ["5"], points: 5 },
      { labels: ["24"], answers: ["1"], points: 5 },
      { labels: ["25"], answers: ["4"], points: 7 },
      { labels: ["26"], answers: ["1"], points: 7 },
      { labels: ["27"], answers: ["3"], points: 7 },
      { labels: ["28"], answers: ["4"], points: 7 },
      { labels: ["29"], answers: ["1"], points: 7 },
    ] },
    { id: "s4", title: sectionTitle(4), rows: [
      { labels: ["30"], answers: ["1"], points: 4 },
      { labels: ["31"], answers: ["4"], points: 4 },
      { labels: ["32"], answers: ["5"], points: 4 },
      { labels: ["33"], answers: ["5"], points: 6 },
      { labels: ["34"], answers: ["4"], points: 6 },
      { labels: ["35"], answers: ["3"], points: 6 },
      { labels: ["36"], answers: ["3"], points: 6 },
      { labels: ["37"], answers: ["2"], points: 7 },
      { labels: ["38"], answers: ["1"], points: 7 },
    ] },
  ]);
  normalizeVisibleMax(schema, 200);
}

updateRetakeAndPublic(2024, "biology", fixRetake2024BiologyExact);
updateRetakeAndPublic(2024, "biology_basics", fixRetake2024BiologyBasicsExact);
updateRetakeAndPublic(2024, "japanese", fixRetake2024JapaneseExact);
function fixRetake2025BiologyExact(schema) {
  rebuildMarksheetFromRows(schema, [
    { id: "s1", title: "第1問", rows: [
      { labels: ["1"], answers: ["1"], points: 4 },
      { labels: ["2"], answers: ["3"], points: 3 },
      { labels: ["3"], answers: ["3"], points: 4 },
      { labels: ["4"], answers: ["9"], points: 5 },
      { labels: ["5"], answers: ["8"], points: 4 },
    ] },
    { id: "s2", title: "第2問", rows: [
      { labels: ["6"], answers: ["6"], points: 4 },
      { labels: ["7"], answers: ["2"], points: 4 },
      { labels: ["8", "9"], answers: ["5", "6"], points: 6, unordered: true },
      { labels: ["10"], answers: ["3"], points: 4 },
    ] },
    { id: "s3", title: "第3問", rows: [
      { labels: ["11", "12"], answers: ["1", "6"], points: 6, unordered: true },
      { labels: ["13"], answers: ["6"], points: 5 },
      { labels: ["14"], answers: ["1"], points: 4 },
      { labels: ["15"], answers: ["1"], points: 5 },
    ] },
    { id: "s4", title: "第4問", rows: [
      { labels: ["16"], answers: ["5"], points: 3 },
      { labels: ["17"], answers: ["4"], points: 4 },
      { labels: ["18"], answers: ["7"], points: 5 },
      { labels: ["19"], answers: ["5"], points: 4 },
      { labels: ["20"], answers: ["7"], points: 5 },
    ] },
    { id: "s5", title: "第5問", rows: [
      { labels: ["21", "22"], answers: ["4", "7"], points: 8, unordered: true },
      { labels: ["23"], answers: ["2"], points: 5 },
      { labels: ["24"], answers: ["3"], points: 4 },
      { labels: ["25"], answers: ["4"], points: 4 },
    ] },
  ]);
  addSingleQuestionPartialByLabel(schema, "13", ["2", "3"], 2);
  addSingleQuestionPartialByLabel(schema, "20", ["8"], 2);
}

updateRetakeAndPublic(2025, "biology", fixRetake2025BiologyExact);
updateRetakeAndPublic(2025, "japanese", (schema) => {
  const ids = ["23", "24"].map((label) => (schema.questions ?? []).find((question) => String(question.displayLabel) === label)?.id);
  if (ids.every(Boolean)) {
    setCompositeRule(schema, ids, {
      id: "rule_23_24_unordered",
      points: 8,
      orderMatters: false,
    });
    normalizeVisibleMax(schema, 200);
  }
});

const q2025Kana = {
  a: "\u30a2",
  i: "\u30a4",
  u: "\u30a6",
  e: "\u30a8",
  o: "\u30aa",
  ka: "\u30ab",
  ki: "\u30ad",
  ku: "\u30af",
  ke: "\u30b1",
  ko: "\u30b3",
  sa: "\u30b5",
  shi: "\u30b7",
  su: "\u30b9",
  se: "\u30bb",
  so: "\u30bd",
  ta: "\u30bf",
  chi: "\u30c1",
  tsu: "\u30c4",
  te: "\u30c6",
  to: "\u30c8",
  na: "\u30ca",
  ni: "\u30cb",
  nu: "\u30cc",
  ne: "\u30cd",
  no: "\u30ce",
  ha: "\u30cf",
};

function sectionTitle(index) {
  return `\u7b2c${index}\u554f`;
}

function questionBySectionLabel(schema, sectionId, label) {
  return (schema.questions ?? []).find(
    (question) => question.sectionId === sectionId && String(question.displayLabel) === String(label),
  );
}

function ruleForLabels(schema, sectionId, labels) {
  const ids = labels.map((label) => questionBySectionLabel(schema, sectionId, label)?.id).filter(Boolean);
  if (ids.length !== labels.length) return undefined;
  return (schema.scoringRules ?? []).find((rule) => ids.every((id) => (rule.questionIds ?? []).includes(id)));
}

function addSingleQuestionPartialBySectionLabel(schema, sectionId, label, partialAnswers, points) {
  const question = questionBySectionLabel(schema, sectionId, label);
  if (!question) return;
  const rule = (schema.scoringRules ?? []).find((item) => (item.questionIds ?? []).includes(question.id));
  if (!rule) return;
  rule.partialCredit = [
    {
      acceptedVariants: partialAnswers.map((answer) => [String(answer)]),
      points,
    },
  ];
}

function oneCorrectPartialVariants(correctAnswers, choices = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"]) {
  const [left, right] = correctAnswers.map(String);
  const variants = [];
  for (const choice of choices.map(String)) {
    if (choice !== right) variants.push([left, choice]);
    if (choice !== left) variants.push([choice, right]);
  }
  return Array.from(new Map(variants.map((variant) => [variant.join("\0"), variant])).values());
}

function oneCorrectUnorderedPartialVariants(correctAnswers, choices = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]) {
  const correct = new Set(correctAnswers.map(String));
  const variants = [];
  for (const left of choices.map(String)) {
    for (const right of choices.map(String)) {
      const matched = new Set([left, right].filter((value) => correct.has(value))).size;
      if (matched === 1) variants.push([left, right]);
    }
  }
  return Array.from(new Map(variants.map((variant) => [variant.join("\0"), variant])).values());
}

function questionByDisplayLabel(schema, label) {
  return (schema.questions ?? []).find((question) => String(question.displayLabel) === String(label));
}

function ruleForDisplayLabels(schema, labels) {
  const ids = labels.map((label) => questionByDisplayLabel(schema, label)?.id).filter(Boolean);
  if (ids.length !== labels.length) return undefined;
  return (schema.scoringRules ?? []).find((rule) => ids.every((id) => (rule.questionIds ?? []).includes(id)));
}

function setCompositeRuleForDisplayLabels(schema, labels, options = {}) {
  const ids = labels.map((label) => questionByDisplayLabel(schema, label)?.id).filter(Boolean);
  if (ids.length !== labels.length) return undefined;
  setCompositeRule(schema, ids, options);
  return ruleForDisplayLabels(schema, labels);
}

function fixMain2023PhysicsExact(schema) {
  rebuildMarksheetFromRows(schema, [
    { id: "s1", title: sectionTitle(1), rows: [
      { labels: ["1"], answers: ["3"], points: 5 },
      { labels: ["2"], answers: ["3"], points: 2 },
      { labels: ["3"], answers: ["3"], points: 3 },
      { labels: ["4"], answers: ["4"], points: 2 },
      { labels: ["5"], answers: ["2"], points: 3 },
      { labels: ["6"], answers: ["4"], points: 5 },
      { labels: ["7"], answers: ["5"], points: 5 },
    ] },
    { id: "s2", title: sectionTitle(2), rows: [
      { labels: ["8"], answers: ["6"], points: 5 },
      { labels: ["9", "10", "11"], answers: ["1", "5", "0"], points: 5 },
      { labels: ["12"], answers: ["2"], points: 4 },
      { labels: ["13", "14"], answers: ["4", "8"], points: 6, unordered: true },
      { labels: ["15"], answers: ["9"], points: 5 },
    ] },
    { id: "s3", title: sectionTitle(3), rows: [
      { labels: ["16"], answers: ["5"], points: 5 },
      { labels: ["17"], answers: ["6"], points: 5 },
      { labels: ["18"], answers: ["6"], points: 5 },
      { labels: ["19"], answers: ["1"], points: 5 },
      { labels: ["20"], answers: ["4"], points: 5 },
    ] },
    { id: "s4", title: sectionTitle(4), rows: [
      { labels: ["21"], answers: ["8"], points: 5 },
      { labels: ["22"], answers: ["7"], points: 5 },
      { labels: ["23"], answers: ["3"], points: 2 },
      { labels: ["24"], answers: ["8"], points: 3 },
      { labels: ["25"], answers: ["4"], points: 5 },
      { labels: ["26"], answers: ["5"], points: 5 },
    ] },
  ]);
  const q9Rule = ruleForLabels(schema, "s2", ["9", "10", "11"]);
  if (q9Rule) q9Rule.partialCredit = [{ acceptedVariants: [["1", "6", "0"]], points: 2 }];
  addSingleQuestionPartialByLabel(schema, "16", ["2", "4"], 1);
  addSingleQuestionPartialByLabel(schema, "18", ["4", "5"], 1);
}

function fixMain2024EarthSciencePartial(schema) {
  const rule = ruleForLabels(schema, undefined, ["15", "16"]);
  if (!rule) return;
  rule.partialCredit = [
    {
      acceptedVariants: oneCorrectUnorderedPartialVariants(["2", "6"]),
      points: 3,
    },
  ];
}

function fixMain2023InformationRelatedBasicsExact(schema) {
  const k = q2025Kana;
  rebuildMarksheetFromRows(schema, [
    { id: "s1", title: sectionTitle(1), rows: [
      { labels: [k.a], answers: ["2"], points: 2 },
      { labels: [k.i], answers: ["5"], points: 2 },
      { labels: [k.u], answers: ["6"], points: 2 },
      { labels: [k.e], answers: ["1"], points: 2 },
      { labels: [k.o, k.ka, k.ki], answers: ["0", "1", "3"], points: 2, unordered: true },
      { labels: [k.ku], answers: ["0"], points: 2 },
      { labels: [k.ke, k.ko], answers: ["3", "6"], points: 2 },
      { labels: [k.sa], answers: ["0"], points: 2 },
      { labels: [k.shi], answers: ["2"], points: 2 },
      { labels: [k.su], answers: ["3"], points: 2 },
      { labels: [k.se], answers: ["2"], points: 2 },
      { labels: [k.so], answers: ["0"], points: 2 },
      { labels: [k.ta], answers: ["3"], points: 2 },
      { labels: [k.chi], answers: ["2"], points: 2 },
      { labels: [k.tsu], answers: ["2"], points: 2 },
    ] },
    { id: "s2", title: sectionTitle(2), rows: [
      { labels: [k.a], answers: ["1"], points: 2 },
      { labels: [k.i], answers: ["1"], points: 2 },
      { labels: [k.u], answers: ["8"], points: 2 },
      { labels: [k.e], answers: ["5"], points: 2 },
      { labels: [k.o], answers: ["4"], points: 3 },
      { labels: [k.ka], answers: ["1"], points: 2 },
      { labels: [k.ki], answers: ["0"], points: 2 },
      { labels: [k.ku], answers: ["2"], points: 2 },
      { labels: [k.ke], answers: ["4"], points: 2 },
      { labels: [k.ko, k.sa], answers: ["1", "2"], points: 2, unordered: true },
      { labels: [k.shi], answers: ["3"], points: 2 },
      { labels: [k.su], answers: ["6"], points: 2 },
      { labels: [k.se], answers: ["3"], points: 2 },
      { labels: [k.so], answers: ["2"], points: 2 },
      { labels: [k.ta], answers: ["3"], points: 2 },
      { labels: [k.chi], answers: ["9"], points: 2 },
      { labels: [k.tsu], answers: ["8"], points: 2 },
    ] },
    { id: "s3", title: sectionTitle(3), rows: [
      { labels: [k.a, k.i, k.u, k.e], answers: ["3", "0", "2", "5"], points: 2 },
      { labels: [k.o], answers: ["2"], points: 2 },
      { labels: [k.ka], answers: ["3"], points: 2 },
      { labels: [k.ki], answers: ["4"], points: 3 },
      { labels: [k.ku], answers: ["2"], points: 2 },
      { labels: [k.ke], answers: ["0"], points: 2 },
      { labels: [k.ko], answers: ["3"], points: 1 },
      { labels: [k.sa, k.shi], answers: ["3", "1"], points: 1 },
      { labels: [k.su], answers: ["6"], points: 3 },
      { labels: [k.se], answers: ["1"], points: 2 },
      { labels: [k.so], answers: ["7"], points: 3 },
      { labels: [k.ta], answers: ["3"], points: 3 },
      { labels: [k.chi], answers: ["1"], points: 3 },
      { labels: [k.tsu], answers: ["3"], points: 1 },
      { labels: [k.te], answers: ["3"], points: 1 },
      { labels: [k.to], answers: ["4"], points: 1 },
      { labels: [k.na], answers: ["8"], points: 3 },
    ] },
    { id: "s4", title: sectionTitle(4), rows: [
      { labels: [k.a], answers: ["4"], points: 2 },
      { labels: [k.i, k.u], answers: ["0", "2"], points: 2 },
      { labels: [k.e, k.o], answers: ["4", "7"], points: 2 },
      { labels: [k.ka, k.ki], answers: ["2", "1"], points: 2 },
      { labels: [k.ku, k.ke], answers: ["0", "1"], points: 2 },
      { labels: [k.ko, k.sa], answers: ["1", "8"], points: 3, unordered: true },
      { labels: [k.shi], answers: ["4"], points: 2 },
      { labels: [k.su], answers: ["5"], points: 2 },
      { labels: [k.se], answers: ["4"], points: 2 },
      { labels: [k.so], answers: ["2"], points: 2 },
      { labels: [k.ta], answers: ["1"], points: 2 },
      { labels: [k.chi], answers: ["1"], points: 2 },
      { labels: [k.tsu], answers: ["0"], points: 2 },
      { labels: [k.te], answers: ["9"], points: 2 },
      { labels: [k.to], answers: ["1"], points: 2 },
      { labels: [k.na, k.ni], answers: ["2", "3"], points: 2 },
      { labels: [k.nu, k.ne, k.no, k.ha], answers: ["4", "4", "1", "2"], points: 2 },
    ] },
  ]);
  schema.selectionGroups = [{ title: "\u7b2c3\u554f\u30fb\u7b2c4\u554f\u304b\u30891\u554f\u9078\u629e", sectionIds: ["s3", "s4"], maxSelect: 1 }];
}

function fixMain2025ScienceBasicsExact(schema) {
  rebuildMarksheetFromRows(schema, [
    { id: "physics_basics", title: "\u7269\u7406\u57fa\u790e", rows: [
      { labels: ["101"], answers: ["1"], points: 4 },
      { labels: ["102"], answers: ["6"], points: 4 },
      { labels: ["103"], answers: ["6"], points: 4 },
      { labels: ["104"], answers: ["5"], points: 4 },
      { labels: ["105"], answers: ["2"], points: 3 },
      { labels: ["106"], answers: ["3"], points: 3 },
      { labels: ["107"], answers: ["5"], points: 3 },
      { labels: ["108"], answers: ["1"], points: 3 },
      { labels: ["109"], answers: ["3"], points: 4 },
      { labels: ["110"], answers: ["4"], points: 3 },
      { labels: ["111"], answers: ["3"], points: 3 },
      { labels: ["112"], answers: ["2"], points: 3 },
      { labels: ["113"], answers: ["6"], points: 3 },
      { labels: ["114"], answers: ["3"], points: 3 },
      { labels: ["115"], answers: ["1"], points: 3 },
    ] },
    { id: "chemistry_basics", title: "\u5316\u5b66\u57fa\u790e", rows: [
      { labels: ["101"], answers: ["3"], points: 3 },
      { labels: ["102"], answers: ["4"], points: 3 },
      { labels: ["103"], answers: ["2"], points: 3 },
      { labels: ["104"], answers: ["1"], points: 3 },
      { labels: ["105"], answers: ["2"], points: 3 },
      { labels: ["106"], answers: ["4"], points: 3 },
      { labels: ["107"], answers: ["1"], points: 3 },
      { labels: ["108"], answers: ["1"], points: 3 },
      { labels: ["109"], answers: ["2"], points: 3 },
      { labels: ["110"], answers: ["3"], points: 3 },
      { labels: ["111", "112", "113"], answers: ["4", "4", "2"], points: 3 },
      { labels: ["114"], answers: ["3"], points: 3 },
      { labels: ["115"], answers: ["1"], points: 3 },
      { labels: ["116"], answers: ["3"], points: 3 },
      { labels: ["117"], answers: ["3"], points: 4 },
      { labels: ["118", "119"], answers: ["1", "2"], points: 4 },
    ] },
    { id: "biology_basics", title: "\u751f\u7269\u57fa\u790e", rows: [
      { labels: ["101"], answers: ["4"], points: 2 },
      { labels: ["102"], answers: ["7"], points: 3 },
      { labels: ["103"], answers: ["2"], points: 3 },
      { labels: ["104", "105"], answers: ["2", "5"], points: 4, unordered: true },
      { labels: ["106"], answers: ["3"], points: 4 },
      { labels: ["107"], answers: ["3"], points: 3 },
      { labels: ["108"], answers: ["2"], points: 3 },
      { labels: ["109"], answers: ["3"], points: 3 },
      { labels: ["110"], answers: ["2"], points: 3 },
      { labels: ["111"], answers: ["6"], points: 3 },
      { labels: ["112"], answers: ["3"], points: 3 },
      { labels: ["113"], answers: ["1"], points: 3 },
      { labels: ["114"], answers: ["4"], points: 3 },
      { labels: ["115"], answers: ["1"], points: 3 },
      { labels: ["116"], answers: ["3"], points: 4 },
      { labels: ["117"], answers: ["2"], points: 3 },
    ] },
    { id: "earth_science_basics", title: "\u5730\u5b66\u57fa\u790e", rows: [
      { labels: ["101"], answers: ["1"], points: 4 },
      { labels: ["102"], answers: ["3"], points: 3 },
      { labels: ["103"], answers: ["2"], points: 3 },
      { labels: ["104"], answers: ["2"], points: 4 },
      { labels: ["105"], answers: ["2"], points: 3 },
      { labels: ["106"], answers: ["1"], points: 3 },
      { labels: ["107"], answers: ["4"], points: 3 },
      { labels: ["108"], answers: ["1"], points: 3 },
      { labels: ["109"], answers: ["1"], points: 4 },
      { labels: ["110"], answers: ["4"], points: 4 },
      { labels: ["111"], answers: ["3"], points: 3 },
      { labels: ["112"], answers: ["1"], points: 3 },
      { labels: ["113"], answers: ["3"], points: 3 },
      { labels: ["114"], answers: ["2"], points: 4 },
      { labels: ["115"], answers: ["2"], points: 3 },
    ] },
  ]);
  schema.selectionGroups = [{
    id: "science_basics_select_two",
    title: "4\u79d1\u76ee\u304b\u30892\u79d1\u76ee\u9078\u629e",
    sectionIds: ["physics_basics", "chemistry_basics", "biology_basics", "earth_science_basics"],
    minSelect: 2,
    maxSelect: 2,
  }];
  const biology104105 = ruleForLabels(schema, "biology_basics", ["104", "105"]);
  if (biology104105) {
    biology104105.partialCredit = [{ acceptedVariants: oneCorrectUnorderedPartialVariants(["2", "5"]), points: 2 }];
  }
  addSingleQuestionPartialBySectionLabel(schema, "biology_basics", "106", ["1", "4", "7"], 1);
  addSingleQuestionPartialBySectionLabel(schema, "biology_basics", "116", ["1", "4", "7"], 1);
}

function fixMain2025MathIibcExact(schema) {
  const k = q2025Kana;
  rebuildMarksheetFromRows(schema, [
    { id: "s1", title: sectionTitle(1), rows: [
      { labels: [k.a, k.i, k.u], answers: ["6", "3", "2"], points: 2 },
      { labels: [k.e], answers: ["2"], points: 3 },
      { labels: [k.o, k.ka, k.ki, k.ku], answers: ["2", "5", "1", "8"], points: 3 },
      { labels: [k.ke, k.ko, k.sa, k.shi, k.su], answers: ["6", "1", "7", "1", "8"], points: 3 },
      { labels: [k.se], answers: ["6"], points: 1 },
      { labels: [k.so, k.ta, k.chi, k.tsu], answers: ["1", "1", "1", "8"], points: 3 },
    ] },
    { id: "s2", title: sectionTitle(2), rows: [
      { labels: [k.a], answers: ["3"], points: 3 },
      { labels: [k.i], answers: ["1"], points: 2 },
      { labels: [k.u, k.e, k.o, k.ka], answers: ["0", "4", "0", "2"], points: 2 },
      { labels: [k.ki, k.ku, k.ke], answers: ["3", "6", "0"], points: 2 },
      { labels: [k.ko], answers: ["3"], points: 3 },
      { labels: [k.sa, k.shi], answers: ["1", "6"], points: 3 },
    ] },
    { id: "s3", title: sectionTitle(3), rows: [
      { labels: [k.a, k.i], answers: ["6", "6"], points: 2 },
      { labels: [k.u, k.e], answers: ["-", "1"], points: 2 },
      { labels: [k.o, k.ka], answers: ["2", "3"], points: 2 },
      { labels: [k.ki], answers: ["0"], points: 2 },
      { labels: [k.ku, k.ke], answers: ["-", "1"], points: 1 },
      { labels: [k.ko, k.sa], answers: ["0", "0"], points: 1 },
      { labels: [k.shi, k.su], answers: ["0", "1"], points: 1 },
      { labels: [k.se], answers: ["3"], points: 2 },
      { labels: [k.so, k.ta], answers: ["3", "0"], points: 2 },
      { labels: [k.chi, k.tsu], answers: ["2", "0"], points: 2 },
      { labels: [k.te, k.to], answers: ["0", "0"], points: 2 },
      { labels: [k.na], answers: ["2"], points: 3 },
    ] },
    { id: "s4", title: sectionTitle(4), rows: [
      { labels: [k.a, k.i], answers: ["5", "8"], points: 2 },
      { labels: [k.u, k.e, k.o], answers: ["0", "3", "0"], points: 2 },
      { labels: [k.ka, k.ki, k.ku], answers: ["6", "1", "0"], points: 3 },
      { labels: [k.ke], answers: ["7"], points: 2 },
      { labels: [k.ko], answers: ["1"], points: 2 },
      { labels: [k.sa], answers: ["7"], points: 2 },
      { labels: [k.shi, k.su, k.se, k.so], answers: ["3", "-", "3", "2"], points: 3 },
    ] },
    { id: "s5", title: sectionTitle(5), rows: [
      { labels: [k.a, k.i, k.u, k.e], answers: ["4", "3", "3", "2"], points: 2 },
      { labels: [k.o], answers: ["4"], points: 2 },
      { labels: [k.ka], answers: ["6"], points: 1 },
      { labels: [k.ki], answers: ["5"], points: 2 },
      { labels: [k.ku, k.ke, k.ko], answers: ["3", "8", "5"], points: 3 },
      { labels: [k.sa], answers: ["0"], points: 1 },
      { labels: [k.shi], answers: ["5"], points: 1 },
      { labels: [k.su, k.se, k.so, k.ta], answers: ["0", "3", "5", "9"], points: 2 },
      { labels: [k.chi, k.tsu], answers: ["1", "0"], points: 2 },
    ] },
    { id: "s6", title: sectionTitle(6), rows: [
      { labels: [k.a], answers: ["1"], points: 1 },
      { labels: [k.i], answers: ["4"], points: 2 },
      { labels: [k.u, k.e, k.o], answers: ["0", "0", "5"], points: 3 },
      { labels: [k.ka, k.ki, k.ku, k.ke, k.ko], answers: ["3", "5", "3", "1", "0"], points: 2 },
      { labels: [k.sa], answers: ["2"], points: 2 },
      { labels: [k.shi], answers: ["0"], points: 2 },
      { labels: [k.su], answers: ["3"], points: 2 },
      { labels: [k.se], answers: ["4"], points: 2 },
    ] },
    { id: "s7", title: sectionTitle(7), rows: [
      { labels: [k.a, k.i, k.u, k.e], answers: ["4", "8", "4", "2"], points: 2 },
      { labels: [k.o], answers: ["3"], points: 2 },
      { labels: [k.ka], answers: ["4"], points: 2 },
      { labels: [k.ki, k.ku], answers: ["2", "0"], points: 2 },
      { labels: [k.ke], answers: ["6"], points: 2 },
      { labels: [k.ko], answers: ["0"], points: 2 },
      { labels: [k.sa], answers: ["0"], points: 2 },
      { labels: [k.shi], answers: ["1"], points: 2 },
    ] },
  ]);
  schema.selectionGroups = [{ title: "\u7b2c4\u554f\u301c\u7b2c7\u554f\u304b\u30893\u554f\u9078\u629e", sectionIds: ["s4", "s5", "s6", "s7"], maxSelect: 3 }];

  const s5Ki = questionBySectionLabel(schema, "s5", k.ki);
  const s5Kukeko = ruleForLabels(schema, "s5", [k.ku, k.ke, k.ko]);
  if (s5Ki && s5Kukeko) s5Kukeko.requires = [{ questionId: s5Ki.id, value: "5" }];

  const prerequisiteLabels = [k.su, k.se, k.so, k.ta];
  const prerequisiteValues = ["0", "3", "5", "9"];
  const s5Chitsu = ruleForLabels(schema, "s5", [k.chi, k.tsu]);
  if (s5Chitsu) {
    s5Chitsu.requires = prerequisiteLabels.map((label, index) => ({
      questionId: questionBySectionLabel(schema, "s5", label)?.id,
      value: prerequisiteValues[index],
    })).filter((item) => item.questionId);
  }
}

function fixMain2026EnglishExact(schema) {
  rebuildMarksheetFromRows(schema, [
    { id: "s1", title: sectionTitle(1), rows: [
      { labels: ["1"], answers: ["3"], points: 2 },
      { labels: ["2"], answers: ["1"], points: 2 },
      { labels: ["3"], answers: ["2"], points: 2 },
    ] },
    { id: "s2", title: sectionTitle(2), rows: [
      { labels: ["4"], answers: ["1"], points: 3 },
      { labels: ["5"], answers: ["3"], points: 3 },
      { labels: ["6"], answers: ["4"], points: 3 },
      { labels: ["7"], answers: ["2"], points: 3 },
    ] },
    { id: "s3", title: sectionTitle(3), rows: [
      { labels: ["8"], answers: ["2"], points: 3 },
      { labels: ["9", "10", "11", "12"], answers: ["2", "3", "5", "1"], points: 3 },
      { labels: ["13"], answers: ["4"], points: 3 },
    ] },
    { id: "s4", title: sectionTitle(4), rows: [
      { labels: ["14"], answers: ["3"], points: 3 },
      { labels: ["15"], answers: ["3"], points: 3 },
      { labels: ["16"], answers: ["1"], points: 3 },
      { labels: ["17"], answers: ["3"], points: 3 },
    ] },
    { id: "s5", title: sectionTitle(5), rows: [
      { labels: ["18"], answers: ["3"], points: 3 },
      { labels: ["19"], answers: ["4"], points: 3 },
      { labels: ["20"], answers: ["5"], points: 3 },
      { labels: ["21"], answers: ["3"], points: 3 },
      { labels: ["22", "23"], answers: ["3", "5"], points: 4, unordered: true },
    ] },
    { id: "s6", title: sectionTitle(6), rows: [
      { labels: ["24", "25"], answers: ["1", "4"], points: 3, unordered: true },
      { labels: ["26", "27", "28", "29"], answers: ["3", "4", "1", "5"], points: 3 },
      { labels: ["30"], answers: ["4"], points: 3 },
      { labels: ["31"], answers: ["2"], points: 3 },
    ] },
    { id: "s7", title: sectionTitle(7), rows: [
      { labels: ["32"], answers: ["3"], points: 3 },
      { labels: ["33", "34"], answers: ["1", "4"], points: 4, unordered: true },
      { labels: ["35"], answers: ["2"], points: 3 },
      { labels: ["36"], answers: ["1"], points: 3 },
      { labels: ["37"], answers: ["4"], points: 3 },
    ] },
    { id: "s8", title: sectionTitle(8), rows: [
      { labels: ["38"], answers: ["4"], points: 3 },
      { labels: ["39"], answers: ["1"], points: 3 },
      { labels: ["40", "41", "42"], answers: ["3", "5", "1"], points: 4 },
      { labels: ["43"], answers: ["2"], points: 3 },
      { labels: ["44"], answers: ["3"], points: 4 },
    ] },
  ]);
  const q22q23 = ruleForLabels(schema, "s5", ["22", "23"]);
  if (q22q23) q22q23.partialCredit = [{ acceptedVariants: oneCorrectPartialVariants(["3", "5"], ["1", "2", "3", "4", "5"]), points: 2 }];
  const q40q42 = ruleForLabels(schema, "s8", ["40", "41", "42"]);
  if (q40q42) q40q42.acceptedVariants = [["3", "5", "1"], ["5", "3", "1"]];
}

function fixMain2023EnglishReadingUnordered(schema) {
  rebuildMarksheetFromRows(schema, [
    { id: "s1", title: sectionTitle(1), rows: [
      { labels: ["1"], answers: ["1"], points: 2 },
      { labels: ["2"], answers: ["4"], points: 2 },
      { labels: ["3"], answers: ["3"], points: 2 },
      { labels: ["4"], answers: ["4"], points: 2 },
      { labels: ["5"], answers: ["3"], points: 2 },
    ] },
    { id: "s2", title: sectionTitle(2), rows: [
      { labels: ["6"], answers: ["2"], points: 2 },
      { labels: ["7"], answers: ["2"], points: 2 },
      { labels: ["8"], answers: ["2"], points: 2 },
      { labels: ["9"], answers: ["4"], points: 2 },
      { labels: ["10"], answers: ["1"], points: 2 },
      { labels: ["11"], answers: ["4"], points: 2 },
      { labels: ["12"], answers: ["1"], points: 2 },
      { labels: ["13"], answers: ["1"], points: 2 },
      { labels: ["14"], answers: ["1"], points: 2 },
      { labels: ["15"], answers: ["2"], points: 2 },
    ] },
    { id: "s3", title: sectionTitle(3), rows: [
      { labels: ["16"], answers: ["2"], points: 3 },
      { labels: ["17"], answers: ["3"], points: 3 },
      { labels: ["18", "19", "20", "21"], answers: ["3", "4", "2", "1"], points: 3 },
      { labels: ["22"], answers: ["3"], points: 3 },
      { labels: ["23"], answers: ["2"], points: 3 },
    ] },
    { id: "s4", title: sectionTitle(4), rows: [
      { labels: ["24"], answers: ["1"], points: 3 },
      { labels: ["25"], answers: ["1"], points: 3 },
      { labels: ["26"], answers: ["2"], points: 2 },
      { labels: ["27"], answers: ["5"], points: 2 },
      { labels: ["28"], answers: ["1"], points: 3 },
      { labels: ["29"], answers: ["2"], points: 3 },
    ] },
    { id: "s5", title: sectionTitle(5), rows: [
      { labels: ["30"], answers: ["4"], points: 3 },
      { labels: ["31"], answers: ["3"], points: 3 },
      { labels: ["32", "33", "34", "35"], answers: ["2", "4", "5", "3"], points: 3 },
      { labels: ["36"], answers: ["3"], points: 3 },
    ] },
    { id: "s6", title: sectionTitle(6), rows: [
      { labels: ["37", "38"], answers: ["1", "5"], points: 3, unordered: true },
      { labels: ["39"], answers: ["3"], points: 3 },
      { labels: ["40"], answers: ["4"], points: 3 },
      { labels: ["41", "42"], answers: ["4", "6"], points: 3, unordered: true },
      { labels: ["43"], answers: ["1"], points: 3 },
      { labels: ["44"], answers: ["4"], points: 2 },
      { labels: ["45", "46"], answers: ["1", "5"], points: 3, unordered: true },
      { labels: ["47"], answers: ["3"], points: 2 },
      { labels: ["48"], answers: ["4"], points: 2 },
      { labels: ["49"], answers: ["4"], points: 3 },
    ] },
  ]);
}

function fixMain2022BiologyPartialsExact(schema) {
  const q3 = ruleForDisplayLabels(schema, ["3"]);
  if (q3) q3.partialCredit = [{ acceptedVariants: [["2"], ["4"], ["6"], ["8"]], points: 1 }];

  const q1516 = setCompositeRuleForDisplayLabels(schema, ["15", "16"], {
    id: "rule_15_16_unordered",
    points: 4,
    orderMatters: false,
  });
  if (q1516) q1516.partialCredit = [{ acceptedVariants: oneCorrectUnorderedPartialVariants(["3", "4"]), points: 2 }];

  const q17 = ruleForDisplayLabels(schema, ["17"]);
  if (q17) q17.partialCredit = [{ acceptedVariants: [["4"]], points: 3 }];
}

function fixMain2022JapaneseUnorderedPartials(schema) {
  const q1213 = setCompositeRuleForDisplayLabels(schema, ["12", "13"], {
    id: "rule_12_13_unordered",
    points: 8,
    orderMatters: false,
  });
  if (q1213) q1213.partialCredit = [{ acceptedVariants: oneCorrectUnorderedPartialVariants(["2", "6"]), points: 4 }];
}

function fixMain2024PhysicsExact(schema) {
  rebuildMarksheetFromRows(schema, [
    { id: "s1", title: sectionTitle(1), rows: [
      { labels: ["1"], answers: ["5"], points: 5 },
      { labels: ["2"], answers: ["5"], points: 3 },
      { labels: ["3"], answers: ["3"], points: 2 },
      { labels: ["4"], answers: ["4"], points: 5 },
      { labels: ["5"], answers: ["7"], points: 5 },
      { labels: ["6"], answers: ["7"], points: 5 },
    ] },
    { id: "s2", title: sectionTitle(2), rows: [
      { labels: ["7"], answers: ["6"], points: 5 },
      { labels: ["8"], answers: ["2"], points: 3 },
      { labels: ["9"], answers: ["1"], points: 3 },
      { labels: ["10"], answers: ["9"], points: 5 },
      { labels: ["11"], answers: ["4"], points: 5 },
      { labels: ["12"], answers: ["4"], points: 4 },
    ] },
    { id: "s3", title: sectionTitle(3), rows: [
      { labels: ["13"], answers: ["5"], points: 5 },
      { labels: ["14"], answers: ["3"], points: 5 },
      { labels: ["15"], answers: ["2"], points: 5 },
      { labels: ["16"], answers: ["2"], points: 5 },
      { labels: ["17"], answers: ["4"], points: 5 },
    ] },
    { id: "s4", title: sectionTitle(4), rows: [
      { labels: ["18"], answers: ["2"], points: 5 },
      { labels: ["19"], answers: ["5"], points: 5 },
      { labels: ["20"], answers: ["1"], points: 5 },
      { labels: ["21"], answers: ["6"], points: 5 },
      { labels: ["22"], answers: ["1"], points: 5 },
    ] },
  ]);
  addSingleQuestionPartialBySectionLabel(schema, "s2", "11", ["3"], 1);
}

function fixMain2024PhysicsBasicsExact(schema) {
  rebuildMarksheetFromRows(schema, [
    { id: "s1", title: sectionTitle(1), rows: [
      { labels: ["1"], answers: ["5"], points: 4 },
      { labels: ["2"], answers: ["4"], points: 4 },
      { labels: ["3"], answers: ["6"], points: 4 },
      { labels: ["4"], answers: ["1"], points: 4 },
    ] },
    { id: "s2", title: sectionTitle(2), rows: [
      { labels: ["5"], answers: ["1"], points: 3 },
      { labels: ["6"], answers: ["8"], points: 4 },
      { labels: ["7"], answers: ["4"], points: 4 },
      { labels: ["8"], answers: ["2"], points: 4 },
      { labels: ["9"], answers: ["6"], points: 3 },
    ] },
    { id: "s3", title: sectionTitle(3), rows: [
      { labels: ["10"], answers: ["1"], points: 3 },
      { labels: ["11", "12", "13"], answers: ["3", "3", "2"], points: 3 },
      { labels: ["14"], answers: ["3"], points: 2 },
      { labels: ["15"], answers: ["4"], points: 2 },
      { labels: ["16"], answers: ["8"], points: 3 },
      { labels: ["17"], answers: ["2"], points: 3 },
    ] },
  ]);
}

function fixMain2023ChemistryExact(schema) {
  rebuildMarksheetFromRows(schema, [
    { id: "s1", title: sectionTitle(1), rows: [
      { labels: ["1"], answers: ["3"], points: 3 },
      { labels: ["2"], answers: ["6"], points: 3 },
      { labels: ["3"], answers: ["2"], points: 4 },
      { labels: ["4"], answers: ["2"], points: 2 },
      { labels: ["5"], answers: ["1"], points: 2 },
      { labels: ["6"], answers: ["2"], points: 3 },
      { labels: ["7", "8"], answers: ["2", "1"], points: 3 },
    ] },
    { id: "s2", title: sectionTitle(2), rows: [
      { labels: ["9"], answers: ["6"], points: 3 },
      { labels: ["10", "11"], answers: ["3", "4"], points: 4, unordered: true },
      { labels: ["12"], answers: ["4"], points: 4 },
      { labels: ["13"], answers: ["4"], points: 3 },
      { labels: ["14"], answers: ["6"], points: 3 },
      { labels: ["15"], answers: ["5"], points: 3 },
    ] },
    { id: "s3", title: sectionTitle(3), rows: [
      { labels: ["16"], answers: ["4"], points: 4 },
      { labels: ["17", "18"], answers: ["3", "5"], points: 4, unordered: true },
      { labels: ["19"], answers: ["5"], points: 2 },
      { labels: ["20"], answers: ["2"], points: 2 },
      { labels: ["21"], answers: ["3"], points: 4 },
      { labels: ["22"], answers: ["4"], points: 4 },
    ] },
    { id: "s4", title: sectionTitle(4), rows: [
      { labels: ["23"], answers: ["2"], points: 3 },
      { labels: ["24"], answers: ["2"], points: 4 },
      { labels: ["25"], answers: ["4"], points: 4 },
      { labels: ["26", "27", "28"], answers: ["0", "2", "0"], points: 3 },
      { labels: ["29"], answers: ["3"], points: 3 },
      { labels: ["30"], answers: ["4"], points: 3 },
    ] },
    { id: "s5", title: sectionTitle(5), rows: [
      { labels: ["31"], answers: ["2"], points: 4 },
      { labels: ["32"], answers: ["1"], points: 4 },
      { labels: ["33"], answers: ["3"], points: 4 },
      { labels: ["34"], answers: ["3"], points: 4 },
      { labels: ["35"], answers: ["4"], points: 4 },
    ] },
  ]);
}

function fixMain2023ChemistryBasicsExact(schema) {
  rebuildMarksheetFromRows(schema, [
    { id: "s1", title: sectionTitle(1), rows: [
      { labels: ["1"], answers: ["2"], points: 3 },
      { labels: ["2"], answers: ["3"], points: 3 },
      { labels: ["3"], answers: ["4"], points: 3 },
      { labels: ["4"], answers: ["6"], points: 3 },
      { labels: ["5"], answers: ["4"], points: 3 },
      { labels: ["6"], answers: ["4"], points: 4 },
      { labels: ["7"], answers: ["3"], points: 3 },
      { labels: ["8"], answers: ["3"], points: 4 },
      { labels: ["9"], answers: ["2"], points: 4 },
    ] },
    { id: "s2", title: sectionTitle(2), rows: [
      { labels: ["10", "11", "12"], answers: ["2", "2", "1"], points: 3 },
      { labels: ["13"], answers: ["4"], points: 3 },
      { labels: ["14"], answers: ["2"], points: 3 },
      { labels: ["15", "16"], answers: ["2", "5"], points: 4, unordered: true },
      { labels: ["17"], answers: ["1"], points: 3 },
      { labels: ["18"], answers: ["5"], points: 2 },
      { labels: ["19", "20"], answers: ["2", "5"], points: 2 },
    ] },
  ]);
}

updateMainCommonAndPublic(2023, "physics", fixMain2023PhysicsExact);
updateMainCommonAndPublic(2023, "information_related_basics", fixMain2023InformationRelatedBasicsExact);
updateMainCommonAndPublic(2023, "english", fixMain2023EnglishReadingUnordered);
updateMainCommonAndPublic(2022, "biology", fixMain2022BiologyPartialsExact);
updateMainCommonAndPublic(2022, "japanese", fixMain2022JapaneseUnorderedPartials);
updateMainCommonAndPublic(2023, "chemistry", fixMain2023ChemistryExact);
updateMainCommonAndPublic(2023, "chemistry_basics", fixMain2023ChemistryBasicsExact);
updateMainCommonAndPublic(2024, "physics", fixMain2024PhysicsExact);
updateMainCommonAndPublic(2024, "physics_basics", fixMain2024PhysicsBasicsExact);
updateMainCommonAndPublic(2024, "earth_science", fixMain2024EarthSciencePartial);
updateMainCommonAndPublic(2025, "science_basics", fixMain2025ScienceBasicsExact);
updateMainCommonAndPublic(2025, "math_iibc", fixMain2025MathIibcExact);
updateMainCommonAndPublic(2026, "english", fixMain2026EnglishExact);

console.log("Applied marksheet overrides.");
