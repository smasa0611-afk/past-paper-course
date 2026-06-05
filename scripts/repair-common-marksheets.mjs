import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const requestedRoots = process.argv.slice(2);
const SOURCE_ROOTS = requestedRoots.length ? requestedRoots : ["common", "common_retake"];

const CHOICE_VALUES = Array.from({ length: 9 }, (_, index) => String(index + 1));
const NUMERIC_VALUES = ["-", ...Array.from({ length: 10 }, (_, index) => String(index)), "a", "b", "c", "d", "e"];
const NUMERIC_LABELS = ["-", ...Array.from({ length: 10 }, (_, index) => String(index)), "A", "B", "C", "D", "E"];
const KANA_SEQUENCE = [
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
];

const SUBJECT_KIND = {
  math_ia: "kana-numeric",
  math_iib: "kana-numeric",
  math_iibc: "kana-numeric",
  information_i: "kana-numeric",
  information_related_basics: "kana-numeric",
};

const SKIP_SUBJECTS = new Set([]);

const REPAIR_YEARS = new Set(["2022", "2023", "2024", "2025", "2026"]);

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[‐‑‒–—−－]/g, "-")
    .replaceAll("－", "-")
    .replaceAll("ー", "-")
    .replaceAll("，", ",")
    .replaceAll("、", ",")
    .replaceAll(/\s+/g, "");
}

function groupRows(items) {
  const rows = [];
  for (const item of items) {
    const row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= 2.6);
    if (row) {
      row.items.push(item);
      row.y = (row.y + item.y) / 2;
    } else {
      rows.push({ y: item.y, items: [item] });
    }
  }

  return rows
    .map((row) => ({
      ...row,
      items: row.items.sort((a, b) => a.x - b.x),
    }))
    .sort((a, b) => b.y - a.y);
}

function parseNumberToken(value) {
  const text = normalizeText(value);
  if (/^\d+$/.test(text)) return text;
  return null;
}

function splitLabels(value) {
  const text = normalizeText(value);
  if (!text) return [];
  const range = text.match(/^(\d+)-(\d+)$/);
  if (range) {
    const start = Number(range[1]);
    const end = Number(range[2]);
    if (Number.isInteger(start) && Number.isInteger(end) && end >= start && end - start <= 12) {
      return Array.from({ length: end - start + 1 }, (_, index) => String(start + index));
    }
  }
  return text.split(",").filter(Boolean);
}

function splitAnswers(value) {
  const text = normalizeText(value).toLowerCase();
  if (!text) return [];
  const orMatch = text.match(/^(\d+)又は(\d+)$/);
  if (orMatch) return [orMatch[1], orMatch[2]];
  if (/^[0-9a-e]-[0-9a-e]$/.test(text)) return text.split("-");
  return text.split(",").filter(Boolean);
}

function itemsInRange(items, minX, maxX) {
  return items.filter((item) => item.x >= minX && item.x < maxX);
}

function joinItems(items) {
  return normalizeText(items.map((item) => item.s).join(""));
}

function parseChoiceSide(rowItems, side) {
  const ranges =
    side === "left"
      ? {
          label: [170, 207],
          answer: [220, 266],
          points: [266, 292],
        }
      : {
          label: [386, 428],
          answer: [435, 481],
          points: [481, 512],
        };

  const label = joinItems(itemsInRange(rowItems, ranges.label[0], ranges.label[1]));
  const answer = joinItems(itemsInRange(rowItems, ranges.answer[0], ranges.answer[1]));
  const points = joinItems(itemsInRange(rowItems, ranges.points[0], ranges.points[1]));
  const labels = splitLabels(label);
  const answers = splitAnswers(answer);
  const answerHasHyphen = answer.includes("-");
  if (!labels.length || !answers.length) return [];
  if (!labels.every((candidate) => /^\d+$/.test(candidate))) return [];
  if (!answers.every((candidate) => /^[1-9]$/.test(candidate))) return [];

  if (answerHasHyphen && labels.length === answers.length && answers.length > 1) {
    return [
      {
        label: labels.join("-"),
        answers,
        points: Number.parseInt(points, 10) || 1,
        ordered: false,
      },
    ];
  }

  if (labels.length === answers.length) {
    return labels.map((questionLabel, index) => ({
      label: questionLabel,
      answers: [answers[index]],
      points: Number.parseInt(points, 10) || 1,
      ordered: true,
    }));
  }

  if (labels.length === 1) {
    return [
      {
        label: labels[0],
        answers,
        points: Number.parseInt(points, 10) || 1,
        ordered: false,
      },
    ];
  }

  return labels.map((questionLabel) => ({
    label: questionLabel,
    answers: [],
    points: Number.parseInt(points, 10) || 1,
    ordered: true,
  }));
}

function parseKanaSide(rowItems, side) {
  const ranges =
    side === "left"
      ? {
          label: [112, 177],
          answer: [190, 260],
          points: [260, 292],
        }
      : {
          label: [338, 405],
          answer: [416, 486],
          points: [486, 514],
        };

  const labelText = joinItems(itemsInRange(rowItems, ranges.label[0], ranges.label[1]));
  const answerText = joinItems(itemsInRange(rowItems, ranges.answer[0], ranges.answer[1]));
  const points = joinItems(itemsInRange(rowItems, ranges.points[0], ranges.points[1]));
  const labels = labelText.split(",").filter((label) => KANA_SEQUENCE.includes(label));
  const answers = splitAnswers(answerText);
  const answerHasHyphen = answerText.includes("-");
  if (!labels.length || !answers.length) return [];

  return [
    {
      labels,
      answers,
      points: Number.parseInt(points, 10) || 1,
      ordered: !answerHasHyphen && !rowItems.some((item) => item.s.includes("順序を問わない")),
    },
  ];
}

async function extractItems(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjs.getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
  }).promise;
  const pages = [];

  for (let pageIndex = 1; pageIndex <= doc.numPages; pageIndex += 1) {
    const page = await doc.getPage(pageIndex);
    const textContent = await page.getTextContent();
    const items = textContent.items
      .map((item) => ({
        x: item.transform[4],
        y: item.transform[5],
        s: item.str,
      }))
      .filter((item) => normalizeText(item.s));
    pages.push({ pageIndex, rows: groupRows(items) });
  }

  return pages;
}

async function extractChoiceEntries(pdfPath) {
  const pages = await extractItems(pdfPath);
  const byLabel = new Map();

  for (const page of pages) {
    for (const row of page.rows) {
      for (const side of ["left", "right"]) {
        for (const entry of parseChoiceSide(row.items, side)) {
          if (!entry.answers.length) continue;
          byLabel.set(entry.label, entry);
        }
      }
    }
  }

  return [...byLabel.values()].sort((a, b) => Number(a.label) - Number(b.label));
}

async function extractKanaEntries(pdfPath) {
  const pages = await extractItems(pdfPath);
  const groups = [];

  for (const page of pages) {
    for (const side of ["left", "right"]) {
      const sideEntries = [];
      for (const row of page.rows) {
        const parsed = parseKanaSide(row.items, side);
        sideEntries.push(...parsed);
      }
      if (sideEntries.length) groups.push(...sideEntries);
    }
  }

  return groups;
}

function permutations(values) {
  if (values.length <= 1) return [values];
  const result = [];
  values.forEach((value, index) => {
    const rest = [...values.slice(0, index), ...values.slice(index + 1)];
    for (const variant of permutations(rest)) result.push([value, ...variant]);
  });
  const seen = new Set();
  return result.filter((variant) => {
    const key = variant.join("\u0000");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function acceptedVariants(entry) {
  if (entry.answers.length <= 1) return [entry.answers];
  return entry.ordered ? [entry.answers] : permutations(entry.answers);
}

function rebuildChoiceMarksheet(existing, entries) {
  const byLabel = new Map(entries.map((entry) => [entry.label, entry]));
  const numericLabels = entries.map((entry) => Number(entry.label)).filter((value) => Number.isInteger(value));
  const compositeEntries = entries.filter((entry) => entry.label.includes("-") && entry.answers.length);
  const maxLabel = numericLabels.length ? Math.max(...numericLabels) : 0;
  const normalizedEntries =
    maxLabel > 0 && maxLabel <= 80
      ? Array.from({ length: maxLabel }, (_, index) => {
          const label = String(index + 1);
          return byLabel.get(label) ?? { label, answers: [], points: 1, ordered: true };
        })
      : entries;

  const questions = normalizedEntries.map((entry, index) => ({
    id: `q_${index + 1}`,
    number: index + 1,
    displayLabel: entry.label,
    correctAnswer: entry.answers.length === 1 ? entry.answers[0] : undefined,
    prompt: "各設問の正しい選択肢を選んでください。",
    points: 1,
  }));

  const idByLabel = new Map(questions.map((question) => [question.displayLabel, question.id]));
  const scoringEntries = [...normalizedEntries.filter((entry) => entry.answers.length), ...compositeEntries];
  const scoringRules = scoringEntries
    .map((entry, index) => ({
      id: `rule_${index + 1}`,
      title: `解答番号 ${entry.label}`,
      questionIds:
        entry.answers.length === 1
          ? [idByLabel.get(entry.label)]
          : splitLabels(entry.label).map((label) => idByLabel.get(label)).filter(Boolean),
      acceptedVariants: acceptedVariants(entry),
      points: entry.points || 1,
    }))
    .filter((rule) => rule.questionIds.length);

  return {
    ...existing,
    instructions: "問題PDFを見ながら、解答番号ごとにマークしてください。",
    defaultChoices: CHOICE_VALUES.map((value) => ({ value, label: value })),
    choicesPerRow: 4,
    questions,
    scoringRules,
    sourceLabels: normalizedEntries.map((entry) => entry.label),
  };
}

function rebuildKanaMarksheet(existing, groups, slug) {
  const questions = [];
  const scoringRules = [];
  let questionIndex = 1;
  let ruleIndex = 1;
  let majorIndex = 1;
  let previousFirstLabel = null;

  for (const group of groups) {
    if (previousFirstLabel && group.labels[0] === "ア") majorIndex += 1;
    previousFirstLabel = group.labels[0];

    const questionIds = [];
    group.labels.forEach((label) => {
      const id = `q_${questionIndex}`;
      questionIds.push(id);
      questions.push({
        id,
        number: questionIndex,
        displayLabel: label,
        correctAnswer: group.labels.length === 1 && group.answers.length === 1 ? group.answers[0] : undefined,
        prompt: `第${majorIndex}問`,
        points: 1,
      });
      questionIndex += 1;
    });

    scoringRules.push({
      id: `rule_${ruleIndex}`,
      title: `第${majorIndex}問 ${group.labels.join("・")}`,
      questionIds,
      acceptedVariants: acceptedVariants(group),
      points: group.points || 1,
    });
    ruleIndex += 1;
  }

  return {
    ...existing,
    instructions: "解答欄ごとに数字・記号を選んでください。",
    defaultChoices: NUMERIC_VALUES.map((value, index) => ({ value, label: NUMERIC_LABELS[index] })),
    choicesPerRow: 6,
    questions,
    scoringRules,
    sourceLabels: questions.map((question) => question.displayLabel),
  };
}

function applyMainExamPresentation(rootName, year, slug, schema) {
  if (rootName !== "common_retake") return schema;
  const preserveRetakePresentation = year === "2025" && slug === "english_listening";

  const mainMarksheetPath = path.join(rootDir, "common", year, slug, "marksheet.json");
  if (!fs.existsSync(mainMarksheetPath)) return schema;

  const main = JSON.parse(fs.readFileSync(mainMarksheetPath, "utf8"));
  const mainByNumber = new Map((main.questions ?? []).map((question) => [question.number, question]));

  schema.questions = (schema.questions ?? []).map((question) => {
    const mainQuestion = mainByNumber.get(question.number);
    if (!mainQuestion) return question;
    if (preserveRetakePresentation) return question;
    return {
      ...question,
      prompt: mainQuestion.prompt ?? question.prompt,
      sectionId: mainQuestion.sectionId ?? question.sectionId,
      sectionTitle: mainQuestion.sectionTitle ?? question.sectionTitle,
      choices: mainQuestion.choices ?? question.choices,
    };
  });

  if (main.selectionGroups?.length) {
    const availableSectionIds = new Set(schema.questions.map((question) => question.sectionId).filter(Boolean));
    const applicableGroups = main.selectionGroups.filter((group) =>
      group.sectionIds?.every((sectionId) => availableSectionIds.has(sectionId)),
    );
    if (applicableGroups.length) schema.selectionGroups = applicableGroups;
  }

  return schema;
}

async function repairOne(rootName, year, slug) {
  if (SKIP_SUBJECTS.has(slug)) return null;
  const dir = path.join(rootDir, rootName, year, slug);
  const marksheetPath = path.join(dir, "marksheet.json");
  const metadataPath = path.join(dir, "metadata.json");
  const metadata =
    year === "2022" && fs.existsSync(metadataPath) ? JSON.parse(fs.readFileSync(metadataPath, "utf8")) : {};
  const answerFile = metadata.answer_files?.find((file) => file?.path)?.path ?? "answer.pdf";
  const answerPath = path.join(dir, answerFile);
  if (!fs.existsSync(marksheetPath) || !fs.existsSync(answerPath)) return null;

  const existing = JSON.parse(fs.readFileSync(marksheetPath, "utf8"));
  const kind = SUBJECT_KIND[slug] ?? "choice";
  const rebuilt =
    kind === "kana-numeric"
      ? rebuildKanaMarksheet(existing, await extractKanaEntries(answerPath), slug)
      : rebuildChoiceMarksheet(existing, await extractChoiceEntries(answerPath));
  const next = applyMainExamPresentation(rootName, year, slug, rebuilt);

  if (!next.questions.length) return null;
  fs.writeFileSync(marksheetPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return {
    rootName,
    year,
    slug,
    questions: next.questions.length,
    rules: next.scoringRules?.length ?? 0,
    firstLabels: next.questions.slice(0, 8).map((question) => question.displayLabel),
    lastLabels: next.questions.slice(-5).map((question) => question.displayLabel),
  };
}

async function main() {
  const repaired = [];
  for (const rootName of SOURCE_ROOTS) {
    const sourceRoot = path.join(rootDir, rootName);
    if (!fs.existsSync(sourceRoot)) continue;
    for (const year of fs.readdirSync(sourceRoot).sort()) {
      if (!REPAIR_YEARS.has(year)) continue;
      const yearDir = path.join(sourceRoot, year);
      for (const slug of fs.readdirSync(yearDir).sort()) {
        if (!fs.statSync(path.join(yearDir, slug)).isDirectory()) continue;
        const result = await repairOne(rootName, year, slug);
        if (result) repaired.push(result);
      }
    }
  }
  console.log(JSON.stringify({ repaired }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
