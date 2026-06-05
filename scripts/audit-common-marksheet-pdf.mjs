import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const outputPath = path.join(scriptDir, "..", ".tmp", "common-marksheet-pdf-audit.json");

const sourceRoots = ["common", "common_retake"];
const numericSubjects = new Set(["math_ia", "math_i", "math_iib", "math_iibc", "information_i", "information_related_basics"]);
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

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replaceAll("－", "-")
    .replaceAll("−", "-")
    .replaceAll("‐", "-")
    .replaceAll("，", ",")
    .replaceAll("、", ",")
    .replaceAll(/\s+/g, "");
}

function normalizeAnswer(value) {
  return normalizeText(value).toLowerCase();
}

function groupRows(items) {
  const rows = [];
  for (const item of items) {
    const row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= 2.8);
    if (row) {
      row.items.push(item);
      row.y = (row.y + item.y) / 2;
    } else {
      rows.push({ y: item.y, items: [item] });
    }
  }
  return rows
    .map((row) => ({ ...row, items: row.items.sort((a, b) => a.x - b.x) }))
    .sort((a, b) => b.y - a.y);
}

function itemsInRange(items, minX, maxX) {
  return items.filter((item) => item.x >= minX && item.x < maxX);
}

function joinItems(items) {
  return normalizeText(items.map((item) => item.s).join(""));
}

function splitLabels(value) {
  const text = normalizeText(value);
  if (!text) return [];
  const labels = [];
  for (const chunk of text.split(",").filter(Boolean)) {
    const range = chunk.match(/^(\d+)-(\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (Number.isInteger(start) && Number.isInteger(end) && end >= start && end - start <= 20) {
        labels.push(...Array.from({ length: end - start + 1 }, (_, index) => String(start + index)));
        continue;
      }
    }
    labels.push(chunk);
  }
  return labels;
}

function splitAnswers(value) {
  const text = normalizeAnswer(value);
  if (!text) return [];
  const answers = [];
  for (const chunk of text.split(",").filter(Boolean)) {
    if (/^[0-9a-e]-[0-9a-e]$/.test(chunk)) {
      answers.push(...chunk.split("-"));
    } else {
      answers.push(chunk);
    }
  }
  return answers.filter((answer) => /^[-0-9a-e]+$/.test(answer));
}

function parsePoint(value) {
  const text = normalizeText(value);
  const match = text.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function parseSide(rowItems, ranges, subjectKind) {
  const rawLabel = joinItems(itemsInRange(rowItems, ranges.label[0], ranges.label[1]));
  const rawAnswer = joinItems(itemsInRange(rowItems, ranges.answer[0], ranges.answer[1]));
  const rawPoints = joinItems(itemsInRange(rowItems, ranges.points[0], ranges.points[1]));
  const labels = splitLabels(rawLabel);
  const answers = splitAnswers(rawAnswer);
  const points = parsePoint(rawPoints);
  if (!labels.length || !answers.length || !points) return null;
  if (labels.length !== answers.length) return null;
  if (subjectKind === "choice" && !labels.every((label) => /^\d+$/.test(label))) return null;
  if (subjectKind === "choice" && !answers.every((answer) => /^[1-9]$/.test(answer))) return null;
  if (subjectKind === "numeric" && !answers.every((answer) => /^[-0-9a-e]$/.test(answer))) return null;
  return {
    labels,
    answers,
    points,
    raw: { label: rawLabel, answer: rawAnswer, points: rawPoints },
  };
}

async function extractPdfEntries(pdfPath, subjectKind) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjs.getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
  }).promise;
  const entries = [];
  const rowTexts = [];

  for (let pageIndex = 1; pageIndex <= doc.numPages; pageIndex += 1) {
    const page = await doc.getPage(pageIndex);
    const textContent = await page.getTextContent();
    const items = textContent.items
      .map((item) => ({ x: item.transform[4], y: item.transform[5], s: item.str }))
      .filter((item) => normalizeText(item.s));
    const rows = groupRows(items);
    rowTexts.push(...rows.map((row) => ({ page: pageIndex, text: row.items.map((item) => item.s).join(" ") })));

    const ranges =
      subjectKind === "numeric"
        ? [
            { label: [100, 185], answer: [185, 265], points: [265, 302] },
            { label: [324, 415], answer: [412, 495], points: [492, 530] },
          ]
        : [
            { label: [160, 214], answer: [214, 267], points: [264, 302] },
            { label: [384, 435], answer: [435, 487], points: [484, 525] },
          ];

    for (const row of rows) {
      for (const [sideIndex, range] of ranges.entries()) {
        const parsed = parseSide(row.items, range, subjectKind);
        if (parsed) entries.push({ page: pageIndex, sideIndex, y: row.y, ...parsed });
      }
    }
  }

  const byKey = new Map();
  const sortedEntries = entries.sort((a, b) => a.page - b.page || a.sideIndex - b.sideIndex || b.y - a.y);
  for (const entry of sortedEntries) {
    const key = `${entry.page}|${entry.labels.join("|")}|${entry.answers.join("|")}|${entry.points}`;
    if (!byKey.has(key)) {
      const { sideIndex, y, ...publicEntry } = entry;
      byKey.set(key, publicEntry);
    }
  }
  return { entries: [...byKey.values()], rowTexts };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function canonicalVariant(variant) {
  return variant.map(normalizeAnswer).join("|");
}

function findSchemaQuestions(schema, labels) {
  const byLabel = new Map();
  for (const question of schema.questions ?? []) {
    const label = normalizeText(question.displayLabel);
    if (!label) continue;
    if (!byLabel.has(label)) byLabel.set(label, []);
    byLabel.get(label).push(question);
  }

  const matched = [];
  for (const label of labels) {
    const candidates = byLabel.get(normalizeText(label)) ?? [];
    const unused = candidates.find((candidate) => !matched.some((item) => item.id === candidate.id));
    if (!unused) return [];
    matched.push(unused);
  }
  return matched;
}

function findRule(schema, questionIds) {
  const target = new Set(questionIds);
  const exact = (schema.scoringRules ?? []).find(
    (rule) => rule.questionIds?.length === questionIds.length && rule.questionIds.every((questionId) => target.has(questionId)),
  );
  if (exact) return exact;
  if (questionIds.length === 1) {
    const question = (schema.questions ?? []).find((item) => item.id === questionIds[0]);
    if (question?.correctAnswer) {
      return {
        id: `fallback_${question.id}`,
        questionIds,
        acceptedVariants: [[String(question.correctAnswer)]],
        points: question.points ?? 1,
      };
    }
  }
  return null;
}

function compareEntry(schema, entry) {
  const questions = findSchemaQuestions(schema, entry.labels);
  if (questions.length !== entry.labels.length) {
    return { type: "missing-question", labels: entry.labels, expected: entry.answers, page: entry.page, raw: entry.raw };
  }

  const rule = findRule(schema, questions.map((question) => question.id));
  if (!rule) {
    return { type: "missing-rule", labels: entry.labels, expected: entry.answers, page: entry.page, raw: entry.raw };
  }

  const expected = canonicalVariant(entry.answers);
  const actualVariants = new Set((rule.acceptedVariants ?? []).map(canonicalVariant));
  const actualUnordered = new Set((rule.acceptedVariants ?? []).map((variant) => canonicalVariant([...variant].sort())));
  const expectedUnordered = canonicalVariant([...entry.answers].sort());
  const variantMatches = actualVariants.has(expected) || rule.orderMatters === false && actualUnordered.has(expectedUnordered);
  const pointsMatch = Number(rule.points) === Number(entry.points);

  if (variantMatches && pointsMatch) return null;

  return {
    type: "rule-mismatch",
    labels: entry.labels,
    expected: { answers: entry.answers, points: entry.points },
    actual: { id: rule.id, acceptedVariants: rule.acceptedVariants, points: rule.points, orderMatters: rule.orderMatters },
    page: entry.page,
    raw: entry.raw,
  };
}

function questionOrder(schema) {
  const order = new Map();
  for (const [index, question] of (schema.questions ?? []).entries()) {
    order.set(question.id, index);
  }
  return order;
}

function ruleSortKey(rule, order) {
  return Math.min(...(rule.questionIds ?? []).map((questionId) => order.get(questionId) ?? Number.MAX_SAFE_INTEGER));
}

function schemaComparableUnits(schema) {
  const order = questionOrder(schema);
  const byId = new Map((schema.questions ?? []).map((question) => [question.id, question]));
  return [...(schema.scoringRules ?? [])]
    .sort((a, b) => ruleSortKey(a, order) - ruleSortKey(b, order))
    .map((rule) => {
      const questions = [...(rule.questionIds ?? [])].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
      return {
        id: rule.id,
        labels: questions.map((questionId) => normalizeText(byId.get(questionId)?.displayLabel ?? questionId)),
        variants: rule.acceptedVariants ?? [],
        points: rule.points,
        orderMatters: rule.orderMatters,
      };
    })
    .filter((unit) => unit.labels.length);
}

function hasDuplicateLabels(entries) {
  const seen = new Set();
  for (const entry of entries) {
    const key = entry.labels.join("|");
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

function variantMatches(unit, expectedAnswers) {
  const expected = canonicalVariant(expectedAnswers);
  const actualVariants = new Set((unit.variants ?? []).map(canonicalVariant));
  const actualUnordered = new Set((unit.variants ?? []).map((variant) => canonicalVariant([...variant].sort())));
  const expectedUnordered = canonicalVariant([...expectedAnswers].sort());
  return actualVariants.has(expected) || unit.orderMatters === false && actualUnordered.has(expectedUnordered);
}

function compareOrderedEntry(entry, units, cursor, subjectKind) {
  const consumed = [];
  let labelCount = 0;
  let index = cursor;
  while (index < units.length && labelCount < entry.labels.length) {
    consumed.push(units[index]);
    labelCount += units[index].labels.length;
    index += 1;
  }

  if (labelCount !== entry.labels.length) {
    return {
      issue: {
        type: "order-missing-rule",
        labels: entry.labels,
        expected: { answers: entry.answers, points: entry.points },
        actual: consumed,
        page: entry.page,
        raw: entry.raw,
      },
      nextCursor: index,
    };
  }

  const actualLabels = consumed.flatMap((unit) => unit.labels);
  const actualAnswers = consumed.flatMap((unit) => {
    if (unit.variants.length === 1) return unit.variants[0];
    return unit.variants[0] ?? [];
  });
  const labelsMatch =
    subjectKind === "numeric" ||
    canonicalVariant(actualLabels) === canonicalVariant(entry.labels);

  let answersMatch = false;
  if (consumed.length === 1) {
    answersMatch = variantMatches(consumed[0], entry.answers);
  } else {
    answersMatch = canonicalVariant(actualAnswers) === canonicalVariant(entry.answers);
  }

  const pointsMatch =
    consumed.length === 1
      ? Number(consumed[0].points) === Number(entry.points)
      : consumed.every((unit) => Number(unit.points) === Number(entry.points));

  if (labelsMatch && answersMatch && pointsMatch) {
    return { issue: null, nextCursor: index, comparedLabel: entry.labels.join("-") };
  }

  return {
    issue: {
      type: "ordered-rule-mismatch",
      labels: entry.labels,
      expected: { answers: entry.answers, points: entry.points },
      actual: consumed.map((unit) => ({
        id: unit.id,
        labels: unit.labels,
        acceptedVariants: unit.variants,
        points: unit.points,
        orderMatters: unit.orderMatters,
      })),
      page: entry.page,
      raw: entry.raw,
    },
    nextCursor: index,
  };
}

function compareSchemaToPdf(schema, entries, subjectKind) {
  const useOrderedComparison = subjectKind === "numeric" || hasDuplicateLabels(entries);
  if (useOrderedComparison) {
    const units = schemaComparableUnits(schema);
    const issues = [];
    const compared = [];
    let cursor = 0;
    for (const entry of entries) {
      const result = compareOrderedEntry(entry, units, cursor, subjectKind);
      cursor = result.nextCursor;
      if (result.issue) issues.push(result.issue);
      else compared.push(result.comparedLabel);
    }
    return { issues, compared, comparisonMode: "order" };
  }

  const issues = [];
  const compared = [];
  for (const entry of entries) {
    const issue = compareEntry(schema, entry);
    if (issue) issues.push(issue);
    else compared.push(entry.labels.join("-"));
  }
  return { issues, compared, comparisonMode: "label" };
}

async function main() {
  const results = [];
  for (const rootName of sourceRoots) {
    const rootDir = path.join(repoRoot, rootName);
    if (!fs.existsSync(rootDir)) continue;
    for (const year of fs.readdirSync(rootDir).sort()) {
      const yearDir = path.join(rootDir, year);
      if (!fs.statSync(yearDir).isDirectory()) continue;
      for (const subject of fs.readdirSync(yearDir).sort()) {
        const id = `${rootName}/${year}/${subject}`;
        if (isHiddenExam(id)) continue;
        const subjectDir = path.join(yearDir, subject);
        if (!fs.statSync(subjectDir).isDirectory()) continue;
        const marksheetPath = path.join(subjectDir, "marksheet.json");
        const answerPath = path.join(subjectDir, "answer.pdf");
        if (!fs.existsSync(marksheetPath) || !fs.existsSync(answerPath)) continue;

        const schema = readJson(marksheetPath);
        const subjectKind = numericSubjects.has(subject) ? "numeric" : "choice";
        const { entries, rowTexts } = await extractPdfEntries(answerPath, subjectKind);
        const { issues, compared, comparisonMode } = compareSchemaToPdf(schema, entries, subjectKind);
        const extractionCoverage = entries.length / Math.max(1, schema.scoringRules?.length ?? schema.questions?.length ?? 1);
        const manualReview =
          entries.length < Math.max(6, Math.min(12, Math.floor((schema.questions?.length ?? 0) * 0.25))) ||
          extractionCoverage < 0.3;
        results.push({
          id,
          subjectKind,
          pdfEntries: entries.length,
          schemaQuestions: schema.questions?.length ?? 0,
          schemaRules: schema.scoringRules?.length ?? 0,
          comparisonMode,
          compared: compared.length,
          issues,
          manualReview,
          pdfExtractedEntries: entries,
          rowTextSample: rowTexts.slice(0, 20),
        });
      }
    }
  }

  const mismatches = results.filter((result) => result.issues.length);
  const manualReviews = results.filter((result) => result.manualReview);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify({ results, mismatches, manualReviews }, null, 2), "utf8");

  console.log(JSON.stringify({
    checked: results.length,
    mismatches: mismatches.length,
    manualReviews: manualReviews.length,
    report: path.relative(repoRoot, outputPath).replaceAll("\\", "/"),
  }, null, 2));

  for (const result of mismatches.slice(0, 80)) {
    console.log(`${result.id}\t${result.issues.slice(0, 5).map((issue) => issue.type).join(",")}`);
  }

  if (mismatches.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
