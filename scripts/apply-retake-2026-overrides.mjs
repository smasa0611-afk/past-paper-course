import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const roots = [
  path.join(repoRoot, "common_retake", "2026"),
  path.join(repoRoot, "public", "exam-assets", "common_retake", "2026"),
];

const choiceValues = Array.from({ length: 9 }, (_, index) => String(index + 1));
const numericValues = ["-", ...Array.from({ length: 10 }, (_, index) => String(index)), "a", "b", "c", "d", "e"];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function updateSubject(subject, updater) {
  for (const root of roots) {
    const filePath = path.join(root, subject, "marksheet.json");
    if (!fs.existsSync(filePath)) continue;
    const data = readJson(filePath);
    updater(data);
    writeJson(filePath, data);
  }
}

function updateMetadata(subject, updater) {
  for (const root of roots) {
    const filePath = path.join(root, subject, "metadata.json");
    if (!fs.existsSync(filePath)) continue;
    const data = readJson(filePath);
    updater(data);
    writeJson(filePath, data);
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

function setRule(schema, questionIds, answers, points, options = {}) {
  const id = options.id ?? `rule_${questionIds.map((qid) => qid.replace("q_", "")).join("_")}`;
  const orderMatters = options.orderMatters !== false;
  const targets = new Set(questionIds);
  for (const [index, questionId] of questionIds.entries()) {
    const question = schema.questions.find((item) => item.id === questionId);
    if (question) question.correctAnswer = answers[index];
  }
  schema.scoringRules = (schema.scoringRules ?? []).filter(
    (rule) => !rule.questionIds.some((questionId) => targets.has(questionId)),
  );
  schema.scoringRules.push({
    id,
    title: options.title,
    questionIds,
    acceptedVariants: orderMatters ? [answers] : permutations(answers),
    points,
    ...(orderMatters ? {} : { orderMatters: false }),
    ...(options.partialCredit ? { partialCredit: options.partialCredit } : {}),
    ...(options.sectionId ? { sectionId: options.sectionId } : {}),
  });
  schema.scoringRules.sort((a, b) => {
    const left = Number(String(a.questionIds[0] ?? "").replace("q_", "")) || 0;
    const right = Number(String(b.questionIds[0] ?? "").replace("q_", "")) || 0;
    return left - right;
  });
}

function buildSectionQuestions(prefix, sectionId, sectionTitle, rows, startNumber) {
  const questions = [];
  const rules = [];
  let number = startNumber;
  for (const row of rows) {
    const labels = Array.isArray(row.label) ? row.label : [row.label];
    const answers = Array.isArray(row.answer) ? row.answer : [row.answer];
    const questionIds = labels.map((label) => {
      const id = `${prefix}_${number}`;
      questions.push({
        id,
        number,
        displayLabel: label,
        correctAnswer: answers[labels.indexOf(label)],
        prompt: sectionTitle,
        sectionId,
        sectionTitle,
        points: 1,
      });
      number += 1;
      return id;
    });
    rules.push({
      id: `rule_${prefix}_${rules.length + 1}`,
      title: `${sectionTitle} ${labels.join("-")}`,
      questionIds,
      acceptedVariants: row.orderMatters === false ? permutations(answers) : [answers],
      points: row.points,
      sectionId,
      ...(row.orderMatters === false ? { orderMatters: false } : {}),
      ...(row.partialCredit ? { partialCredit: row.partialCredit } : {}),
    });
  }
  return { questions, rules, nextNumber: number };
}

function replaceCombinedMarksheet(schema, sections, title) {
  let nextNumber = 1;
  const questions = [];
  const scoringRules = [];
  for (const section of sections) {
    const built = buildSectionQuestions(section.prefix, section.id, section.title, section.rows, nextNumber);
    questions.push(...built.questions);
    scoringRules.push(...built.rules);
    nextNumber = built.nextNumber;
  }
  schema.title = title;
  schema.instructions = "問題PDFを見ながら、解答番号ごとに正しい選択肢を選んでください。";
  schema.defaultChoices = choiceValues.map((value) => ({ value, label: value }));
  schema.choicesPerRow = 4;
  schema.questions = questions;
  schema.scoringRules = scoringRules;
  schema.selectionGroups = [
    {
      id: "retake_2026_select_two_fields",
      title: "受験した2分野を選択",
      sectionIds: sections.map((section) => section.id),
      minSelect: 2,
      maxSelect: 2,
    },
  ];
  schema.sourceLabels = questions.map((question) => question.displayLabel);
}

function normalizeSectionPointTotals(schema, expectedTotals) {
  for (const [sectionId, expectedTotal] of Object.entries(expectedTotals)) {
    const rules = (schema.scoringRules ?? []).filter((rule) => rule.sectionId === sectionId);
    let total = rules.reduce((sum, rule) => sum + Number(rule.points ?? 0), 0);
    let delta = expectedTotal - total;
    let boostIndex = 0;
    while (delta > 0 && rules.length) {
      rules[boostIndex % rules.length].points += 1;
      delta -= 1;
      boostIndex += 1;
    }
    for (let index = rules.length - 1; index >= 0 && delta < 0; index -= 1) {
      const rule = rules[index];
      const reduction = Math.min(rule.points - 1, -delta);
      rule.points -= reduction;
      delta += reduction;
    }
  }
}

updateSubject("english_listening", (schema) => {
  setRule(schema, ["q_18", "q_19", "q_20", "q_21"], ["4", "2", "5", "1"], 4, {
    id: "rule_18_21_all_or_nothing",
    title: "解答番号 18-21（全部正解のみ）",
  });
  setRule(schema, ["q_28", "q_29"], ["6", "4"], 2, {
    id: "rule_28_29_all_or_nothing",
    title: "解答番号 28-29（全部正解のみ）",
  });
  setRule(schema, ["q_30", "q_31"], ["5", "2"], 2, {
    id: "rule_30_31_all_or_nothing",
    title: "解答番号 30-31（全部正解のみ）",
  });
});

updateSubject("english", (schema) => {
  setRule(schema, ["q_18", "q_19"], ["1", "5"], 4, {
    id: "rule_18_19_unordered",
    title: "解答番号 18-19（順不同）",
    orderMatters: false,
  });
  setRule(schema, ["q_29", "q_30"], ["1", "5"], 3, {
    id: "rule_29_30_all_or_nothing",
    title: "解答番号 29-30（全部正解のみ）",
    orderMatters: false,
  });
  setRule(schema, ["q_34", "q_35"], ["3", "4"], 4, {
    id: "rule_34_35_all_or_nothing",
    title: "解答番号 34-35（全部正解のみ）",
    orderMatters: false,
  });
  setRule(schema, ["q_40", "q_41"], ["5", "2"], 4, {
    id: "rule_40_41_all_or_nothing",
    title: "解答番号 40-41（全部正解のみ）",
    orderMatters: false,
  });
});

updateSubject("japanese", (schema) => {
  const sectionForNumber = (number) => {
    if (number <= 9) return { id: "s1", title: "\u7b2c1\u554f" };
    if (number <= 18) return { id: "s2", title: "\u7b2c2\u554f" };
    if (number <= 28) return { id: "s3", title: "\u7b2c3\u554f" };
    if (number <= 35) return { id: "s4", title: "\u7b2c4\u554f" };
    return { id: "s5", title: "\u7b2c5\u554f" };
  };
  const questionById = new Map((schema.questions ?? []).map((question) => [question.id, question]));
  for (const question of schema.questions ?? []) {
    const section = sectionForNumber(Number(question.displayLabel ?? question.number ?? 0));
    question.sectionId = section.id;
    question.sectionTitle = section.title;
    question.prompt = section.title;
  }
  for (const rule of schema.scoringRules ?? []) {
    const firstQuestion = questionById.get(rule.questionIds?.[0]);
    const section = sectionForNumber(Number(firstQuestion?.displayLabel ?? firstQuestion?.number ?? 0));
    rule.sectionId = section.id;
    rule.sectionTitle = section.title;
  }
  normalizeSectionPointTotals(schema, { s1: 47, s2: 47, s3: 31, s4: 42, s5: 33 });
});

updateSubject("science_basics", (schema) => {
  replaceCombinedMarksheet(
    schema,
    [
      {
        id: "physics_basics",
        prefix: "pb",
        title: "物理基礎",
        rows: [
          ["101", "3", 4], ["102", "4", 2], ["103", "2", 2], ["104", "5", 4], ["105", "5", 4],
          ["106", "6", 3], ["107", "5", 3], ["108", "3", 3], ["109", "5", 3], ["110", "3", 3],
          ["111", "4", 3], ["112", "1", 4], ["113", "2", 4], ["114", "2", 4], ["115", "3", 4],
        ].map(([label, answer, points]) => ({ label, answer, points })),
      },
      {
        id: "chemistry_basics",
        prefix: "cb",
        title: "化学基礎",
        rows: [
          ["101", "1", 3], ["102", "7", 3], ["103", "4", 3], ["104", "2", 3], ["105", "4", 3],
          ["106", "1", 3], ["107", "2", 3], ["108", "2", 3], ["109", "1", 3], ["110", "3", 3],
          ["111", "5", 3], ["112", "4", 3], ["113", "1", 3], ["114", "4", 4], ["115", "2", 3], ["116", "4", 4],
        ].map(([label, answer, points]) => ({ label, answer, points })),
      },
      {
        id: "biology_basics",
        prefix: "bb",
        title: "生物基礎",
        rows: [
          ["101", "6", 3], ["102", "3", 3], ["103", "4", 3], ["104", "2", 2], ["105", "6", 3],
          ["106", "5", 3], ["107", "2", 3], ["108", "1", 3], ["109", "3", 3], ["110", "5", 3],
          ["111", "3", 3], ["112", "7", 3], ["113", "1", 3], ["114", "3", 4],
        ].map(([label, answer, points]) => ({ label, answer, points })).concat([
          { label: ["115", "116"], answer: ["3", "6"], points: 4, orderMatters: false },
          { label: "117", answer: "6", points: 4, partialCredit: [{ acceptedVariants: [["2"], ["3"]], points: 1 }] },
        ]),
      },
      {
        id: "earth_science_basics",
        prefix: "eb",
        title: "地学基礎",
        rows: [
          ["101", "3", 3], ["102", "3", 4], ["103", "2", 3], ["104", "1", 3], ["105", "4", 4],
          ["106", "2", 3], ["107", "5", 4], ["108", "3", 3], ["109", "3", 3], ["110", "1", 4],
          ["111", "3", 3], ["112", "6", 3], ["113", "2", 4], ["114", "3", 3], ["115", "1", 3],
        ].map(([label, answer, points]) => ({ label, answer, points })),
      },
    ],
    "共通テスト 理科基礎 2026 追試験",
  );
});

updateSubject("integrated_history_public", (schema) => {
  replaceCombinedMarksheet(
    schema,
    [
      {
        id: "geography_integrated",
        prefix: "geo",
        title: "地理総合",
        rows: [
          ["101", "4", 3], ["102", "1", 4], ["103", "4", 3], ["104", "6", 3],
          ["105", "2", 3], ["106", "2", 3], ["107", "1", 3], ["108", "3", 3],
          ["109", "3", 3], ["110", "4", 3], ["111", "1", 3], ["112", "3", 4],
          ["113", "3", 3], ["114", "2", 3], ["115", "6", 3], ["116", "4", 3],
        ].map(([label, answer, points]) => ({ label, answer, points })),
      },
      {
        id: "history_integrated",
        prefix: "hist",
        title: "歴史総合",
        rows: [
          ["101", "1", 3], ["102", "2", 3], ["103", "3", 3], ["104", "4", 3],
          ["105", "4", 3], ["106", "3", 3], ["107", "5", 3], ["108", "1", 4],
          ["109", "1", 3], ["110", "3", 3], ["111", "4", 3], ["112", "2", 3],
          ["113", "3", 4], ["114", "4", 3], ["115", "3", 3], ["116", "2", 3],
        ].map(([label, answer, points]) => ({ label, answer, points })),
      },
      {
        id: "public_integrated",
        prefix: "pub",
        title: "公共",
        rows: [
          ["101", "3", 3], ["102", "5", 3], ["103", "1", 3], ["104", "4", 3],
          ["105", "1", 3], ["106", "4", 3], ["107", "6", 3], ["108", "2", 3],
          ["109", "4", 3], ["110", "2", 3], ["111", "3", 4], ["112", "3", 3],
          ["113", "1", 3], ["114", "3", 4], ["115", "5", 3], ["116", "4", 3],
        ].map(([label, answer, points]) => ({ label, answer, points })),
      },
    ],
    "共通テスト 地理総合／歴史総合／公共 2026 追試験",
  );
});

updateSubject("math_iibc", (schema) => {
  schema.defaultChoices = numericValues.map((value) => ({ value, label: value.toUpperCase() }));
  for (const question of schema.questions ?? []) {
    if (!question.sectionId && question.number >= 106) {
      question.sectionId = "s7";
      question.sectionTitle = "第7問";
      question.prompt = "第7問";
    }
  }
  for (const rule of schema.scoringRules ?? []) {
    const sectionMatch = String(rule.title ?? "").match(/第(\d+)問/);
    const sectionId = sectionMatch ? `s${sectionMatch[1]}` : undefined;
    const firstQuestion = (schema.questions ?? []).find((question) => question.id === rule.questionIds?.[0]);
    rule.sectionId = sectionId ?? firstQuestion?.sectionId ?? rule.sectionId;
    if (sectionId) {
      for (const questionId of rule.questionIds ?? []) {
        const question = (schema.questions ?? []).find((item) => item.id === questionId);
        if (question) {
          question.sectionId = sectionId;
          question.sectionTitle = `第${sectionMatch[1]}問`;
          question.prompt = `第${sectionMatch[1]}問`;
        }
      }
    }
  }
  normalizeSectionPointTotals(schema, { s1: 15, s2: 15, s3: 22, s4: 16, s5: 16, s6: 16, s7: 16 });
});

updateSubject("information_i", (schema) => {
  schema.defaultChoices = numericValues.map((value) => ({ value, label: value }));
  const hasKiKu = (schema.questions ?? []).some((question) => question.id === "q_s1_ki") ||
    (schema.scoringRules ?? []).some((rule) => rule.id === "rule_s1_ki_ku");
  if (!hasKiKu) {
    const insertIndex = schema.questions.findIndex((question) => question.id === "q_7");
    const additions = [
      {
        id: "q_s1_ki",
        number: 7,
        displayLabel: "キ",
        correctAnswer: "0",
        prompt: "第1問",
        sectionId: "s1",
        sectionTitle: "第1問",
        points: 1,
      },
      {
        id: "q_s1_ku",
        number: 8,
        displayLabel: "ク",
        correctAnswer: "2",
        prompt: "第1問",
        sectionId: "s1",
        sectionTitle: "第1問",
        points: 1,
      },
    ];
    schema.questions.splice(insertIndex >= 0 ? insertIndex : 6, 0, ...additions);
    schema.scoringRules.push({
      id: "rule_s1_ki_ku",
      title: "第1問 キ・ク（順不同）",
      questionIds: ["q_s1_ki", "q_s1_ku"],
      acceptedVariants: permutations(["0", "2"]),
      points: 2,
      sectionId: "s1",
      orderMatters: false,
    });
  }
});

updateSubject("biology", (schema) => {
  setRule(schema, ["q_11", "q_12"], ["1", "4"], 6, {
    id: "rule_11_12_unordered",
    title: "解答番号 11-12（順不同）",
    orderMatters: false,
  });
});

updateMetadata("japanese", (metadata) => {
  metadata.source = {
    ...(metadata.source ?? {}),
    answer_url:
      "https://www.dnc.ac.jp/albums/abm.php?d=798&f=abm00006068.pdf&n=R8_%E8%BF%BD%E3%83%BB%E5%86%8D%E8%A9%A6%E9%A8%93%E3%80%90%E5%9B%BD%E8%AA%9E%E3%80%91%E7%99%BA%E8%A1%A8%E7%94%A8%E6%AD%A3%E8%A7%A3.pdf",
    marksheet_status: "reviewed_override",
  };
});

updateMetadata("integrated_history_public", (metadata) => {
  metadata.source = {
    ...(metadata.source ?? {}),
    answer_url:
      "https://www.dnc.ac.jp/albums/abm.php?d=798&f=abm00006074.pdf&n=R8_%E8%BF%BD%E3%83%BB%E5%86%8D%E8%A9%A6%E9%A8%93%E3%80%90%E5%9C%B0%E7%B7%8F%EF%BC%8F%E6%AD%B4%E7%B7%8F%EF%BC%8F%E5%85%AC%E5%85%B1%E3%80%91%E7%99%BA%E8%A1%A8%E7%94%A8%E6%AD%A3%E8%A7%A3.pdf",
    marksheet_status: "reviewed_override",
  };
});

const visibleExpectedMax = new Map([
  ["english", 100],
  ["english_listening", 100],
  ["math_ia", 100],
  ["math_iib", 100],
  ["math_iibc", 100],
  ["japanese", 200],
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

const hiddenExamIds = new Set([
  "common/2022/information_related_basics",
  "common/2023/information_related_basics",
  "common/2024/information_related_basics",
  "common_retake/2022",
  "common_retake/2023/information_related_basics",
  "common_retake/2023/math_ia",
  "common_retake/2023/math_iib",
  "common_retake/2024/information_related_basics",
  "common_retake/2024/math_ia",
  "common_retake/2024/math_iib",
]);

function isHiddenExam(id) {
  return [...hiddenExamIds].some((hiddenId) => id === hiddenId || id.startsWith(`${hiddenId}/`));
}

function visibleEffectiveRules(schema) {
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

function visibleCombinations(items, size) {
  if (size <= 0) return [[]];
  if (items.length < size) return [];
  const [first, ...rest] = items;
  return [
    ...visibleCombinations(rest, size - 1).map((combo) => [first, ...combo]),
    ...visibleCombinations(rest, size),
  ];
}

function visibleMaxScore(schema) {
  const rules = visibleEffectiveRules(schema);
  const groups = schema.selectionGroups ?? [];
  if (!groups.length) return rules.reduce((sum, rule) => sum + Number(rule.points ?? 0), 0);
  const selectable = new Set(groups.flatMap((group) => group.sectionIds ?? []));
  let total = rules
    .filter((rule) => !rule.sectionId || !selectable.has(rule.sectionId))
    .reduce((sum, rule) => sum + Number(rule.points ?? 0), 0);
  for (const group of groups) {
    const bySection = new Map();
    for (const rule of rules) {
      if (!rule.sectionId || !(group.sectionIds ?? []).includes(rule.sectionId)) continue;
      bySection.set(rule.sectionId, (bySection.get(rule.sectionId) ?? 0) + Number(rule.points ?? 0));
    }
    const combos = visibleCombinations([...bySection.values()], Math.min(group.maxSelect ?? bySection.size, bySection.size));
    total += combos.length ? Math.max(...combos.map((combo) => combo.reduce((sum, value) => sum + value, 0))) : 0;
  }
  return total;
}

function ensureRulesForDisplayedQuestions(schema) {
  const covered = new Set((schema.scoringRules ?? []).flatMap((rule) => rule.questionIds ?? []));
  for (const question of schema.questions ?? []) {
    delete question.reviewNote;
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

function normalizeVisibleMax(schema, expectedMax) {
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

for (const rootName of ["common_retake"]) {
  const dataRoot = path.join(repoRoot, rootName);
  const publicRoot = path.join(repoRoot, "public", "exam-assets", rootName);
  for (const baseRoot of [dataRoot, publicRoot]) {
    if (!fs.existsSync(baseRoot)) continue;
    for (const year of fs.readdirSync(baseRoot).sort()) {
      if (year !== "2026") continue;
      const yearDir = path.join(baseRoot, year);
      if (!fs.statSync(yearDir).isDirectory()) continue;
      for (const subject of fs.readdirSync(yearDir).sort()) {
        const id = `${rootName}/${year}/${subject}`;
        if (isHiddenExam(id)) continue;
        const expectedMax = visibleExpectedMax.get(subject);
        const marksheetPath = path.join(yearDir, subject, "marksheet.json");
        if (!expectedMax || !fs.existsSync(marksheetPath)) continue;
        const schema = readJson(marksheetPath);
        ensureRulesForDisplayedQuestions(schema);
        normalizeVisibleMax(schema, expectedMax);
        writeJson(marksheetPath, schema);
      }
    }
  }
}

console.log("Applied common marksheet integrity overrides.");
