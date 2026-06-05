import fs from "node:fs";
import path from "node:path";
import * as XLSX from "../exam-system/node_modules/xlsx/xlsx.mjs";

const ROOT = process.cwd();
const YEARS = [2026, 2025, 2024, 2023, 2022];
const EXAMS = [
  { dir: "common", label: "本試験" },
  { dir: "common_retake", label: "追試験" },
];

const SUBJECT_LABELS = {
  english: "英語リーディング",
  english_listening: "英語リスニング",
  japanese: "国語",
  math_ia: "数学I・A",
  math_iib: "数学II・B",
  math_iibc: "数学II・B・C",
  physics: "物理",
  physics_basics: "物理基礎",
  chemistry: "化学",
  chemistry_basics: "化学基礎",
  biology: "生物",
  biology_basics: "生物基礎",
  earth_science: "地学",
  earth_science_basics: "地学基礎",
  geography: "地理総合・地理探究",
  geography_b: "地理B",
  integrated_history_public: "歴史総合・公共",
  japanese_history: "日本史探究",
  japanese_history_b: "日本史B",
  world_history: "世界史探究",
  world_history_b: "世界史B",
  ethics: "倫理",
  modern_society: "現代社会",
  politics_economy: "政治・経済",
  ethics_politics_economy: "倫理、政治・経済",
  public_ethics: "公共、倫理",
  public_politics_economy: "公共、政治・経済",
  science_basics: "理科基礎",
  information_i: "情報I",
  information_related_basics: "情報関係基礎",
};

const PUBLIC_BASE_URL = "https://common-test-share.vercel.app";

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function normalizeVariant(variant) {
  return (variant ?? []).map((value) => String(value));
}

function sortedKey(variant) {
  return normalizeVariant(variant).slice().sort().join("\u0001");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function isPermutationOnlyRule(rule) {
  const variants = rule.acceptedVariants ?? [];
  if ((rule.questionIds ?? []).length < 2 || variants.length < 2) return false;
  const keys = unique(variants.map(sortedKey));
  if (keys.length !== 1) return false;
  const ordered = unique(variants.map((variant) => normalizeVariant(variant).join("\u0001")));
  return ordered.length > 1;
}

function questionLabelMap(schema) {
  return new Map((schema.questions ?? []).map((question) => [question.id, String(question.displayLabel ?? question.number ?? question.id)]));
}

function labelsForRule(rule, labelsById) {
  return (rule.questionIds ?? []).map((id) => labelsById.get(id) ?? id);
}

function answerText(rule) {
  const first = normalizeVariant((rule.acceptedVariants ?? [])[0]);
  return first.length ? first.join("・") : "";
}

function partialAnswerText(entry) {
  const variants = entry.acceptedVariants ?? [];
  if (!variants.length) return "";
  return variants.map((variant) => normalizeVariant(variant).join("・")).join(" / ");
}

function collectRules(schema) {
  const labelsById = questionLabelMap(schema);
  const unordered = [];
  const partial = [];

  for (const rule of schema.scoringRules ?? []) {
    const labels = labelsForRule(rule, labelsById);
    const unorderedByFlag = rule.orderMatters === false;
    const unorderedByPermutation = isPermutationOnlyRule(rule);
    if (unorderedByFlag || unorderedByPermutation) {
      unordered.push({
        labels: labels.join("・"),
        answer: answerText(rule),
        points: rule.points ?? "",
        basis: unorderedByFlag ? "orderMatters=false" : "入替パターン登録",
      });
    }
    for (const entry of rule.partialCredit ?? []) {
      partial.push({
        labels: labels.join("・"),
        answer: partialAnswerText(entry),
        points: entry.points ?? "",
      });
    }
  }

  return { unordered, partial };
}

function subjectDirs(examDir, year) {
  const yearDir = path.join(ROOT, examDir, String(year));
  if (!fs.existsSync(yearDir)) return [];
  return fs
    .readdirSync(yearDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => (SUBJECT_LABELS[a] ?? a).localeCompare(SUBJECT_LABELS[b] ?? b, "ja"));
}

function detailList(items) {
  if (!items.length) return "なし";
  return items
    .map((item) => `${item.labels}（答:${item.answer || "-"} / ${item.points}点 / ${item.basis ?? "部分点"}）`)
    .join("； ");
}

function examIdFor(examDir, year, subject) {
  return `${examDir}/${year}/${subject}`;
}

function examUrlFor(examId) {
  return `${PUBLIC_BASE_URL}/exam/${examId}`;
}

function expectedDisplayTitle(examDir, year, subjectLabel) {
  return `共通テスト ${subjectLabel} ${year}${examDir === "common_retake" ? " 追試験" : ""}`;
}

function makeRows() {
  const rows = [];
  let no = 1;
  for (const year of YEARS) {
    for (const exam of EXAMS) {
      for (const subject of subjectDirs(exam.dir, year)) {
        const marksheetPath = path.join(ROOT, exam.dir, String(year), subject, "marksheet.json");
        const metadataPath = path.join(ROOT, exam.dir, String(year), subject, "metadata.json");
        const relativePath = path.relative(ROOT, marksheetPath).replaceAll(path.sep, "/");
        const metadata = fs.existsSync(metadataPath) ? readJson(metadataPath) : {};
        const subjectLabel = SUBJECT_LABELS[subject] ?? subject;
        const expectedHeader = expectedDisplayTitle(exam.dir, year, subjectLabel);
        const examId = examIdFor(exam.dir, year, subject);
        if (!fs.existsSync(marksheetPath)) {
          rows.push({
            no: no++,
            year,
            exam: exam.label,
            subjectLabel,
            expectedHeader,
            examId,
            examUrl: examUrlFor(examId),
            status: "marksheetなし",
            markCount: "",
            unorderedCount: 0,
            unordered: "なし",
            partialCount: 0,
            partial: "なし",
            path: relativePath,
          });
          continue;
        }

        const schema = readJson(marksheetPath);
        const { unordered, partial } = collectRules(schema);
        rows.push({
          no: no++,
          year,
          exam: exam.label,
          subjectLabel,
          expectedHeader,
          examId,
          examUrl: examUrlFor(examId),
          status: "要確認",
          markCount: (schema.questions ?? []).length,
          unorderedCount: unordered.length,
          unordered: detailList(unordered),
          partialCount: partial.length,
          partial: detailList(partial),
          path: relativePath,
        });
      }
    }
  }
  return rows;
}

function writeCsv(rows, outputPath) {
  const headers = [
    "No",
    "試験区分",
    "年度",
    "科目",
    "演習ID",
    "画面URL",
    "想定左上表示",
    "マーク数",
    "確認ステータス",
    "問題PDFチェック",
    "解答PDF",
    "左上表示",
    "マークシート",
    "満点",
    "順不同件数",
    "システム上の順不同設問",
    "部分点件数",
    "システム上の部分点設問",
    "公式解答との差異メモ",
  ];
  const lines = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) =>
      [
        row.no,
        row.exam,
        row.year,
        row.subjectLabel,
        row.examId,
        row.examUrl,
        row.expectedHeader,
        row.markCount,
        row.status,
        "",
        "",
        "",
        "",
        "",
        row.unorderedCount,
        row.unordered,
        row.partialCount,
        row.partial,
        "",
      ]
        .map(csvEscape)
        .join(","),
    ),
  ];
  fs.writeFileSync(outputPath, `\uFEFF${lines.join("\n")}\n`, "utf8");
}

function writeXlsx(rows, outputPath) {
  const instruction =
    "問題PDFはダミー表示のためチェック不要です。解答PDF、左上表示、マークシート、満点採点を確認し、NGや要修正があれば不具合詳細に具体的に記入してください。";
  const headers = [
    "No",
    "試験区分",
    "年度",
    "科目",
    "演習ID",
    "画面URL",
    "想定左上表示",
    "マーク数",
    "確認ステータス",
    "問題PDFチェック",
    "解答PDF",
    "左上表示",
    "マークシート",
    "満点",
    "順不同件数",
    "システム上の順不同設問",
    "部分点件数",
    "システム上の部分点設問",
    "不具合詳細",
  ];
  const dataRows = rows.map((row) => [
    row.no,
    row.exam,
    row.year,
    row.subjectLabel,
    row.examId,
    row.examUrl,
    row.expectedHeader,
    row.markCount,
    row.status,
    "",
    "",
    "",
    "",
    "",
    row.unorderedCount,
    row.unordered,
    row.partialCount,
    row.partial,
    "",
  ]);
  const sheet = XLSX.utils.aoa_to_sheet([[instruction], [], headers, ...dataRows]);
  sheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }];
  sheet["!cols"] = [
    { wch: 6 },
    { wch: 10 },
    { wch: 8 },
    { wch: 22 },
    { wch: 34 },
    { wch: 52 },
    { wch: 32 },
    { wch: 10 },
    { wch: 12 },
    { wch: 16 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
    { wch: 10 },
    { wch: 12 },
    { wch: 56 },
    { wch: 12 },
    { wch: 56 },
    { wch: 44 },
  ];
  sheet["!freeze"] = { xSplit: 0, ySplit: 3 };
  sheet["!autofilter"] = { ref: `A3:S${rows.length + 3}` };

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "チェックリスト");
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer", compression: true });
  fs.writeFileSync(outputPath, buffer);
}

function writeMarkdown(rows, outputPath, csvName) {
  const lines = [
    "# 共通テスト 順不同・部分点チェック表（2026-2022）",
    "",
    "この表は各 `marksheet.json` の採点ルールから自動生成しています。",
    "`orderMatters=false` の明示ルールと、入れ替え済みの正答パターンが登録されているルールを「順不同」として拾っています。",
    "",
    `CSV版: \`${csvName}\``,
    "",
    "| 年度 | 試験 | 科目 | 順不同 | 部分点 | スタッフ確認 | 差異メモ |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) =>
      [
        row.year,
        row.exam,
        `${row.subjectLabel}<br>${row.expectedHeader}`,
        `${row.unorderedCount}件<br>${row.unordered}`,
        `${row.partialCount}件<br>${row.partial}`,
        "",
        "",
      ]
        .map((cell) => String(cell).replaceAll("|", "\\|"))
        .join(" | ")
        .replace(/^/, "| ")
        .replace(/$/, " |"),
    ),
    "",
  ];
  fs.writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");
}

const rows = makeRows();
const outputDir = path.join(ROOT, "docs", "audit");
fs.mkdirSync(outputDir, { recursive: true });

const csvName = "common-order-checklist-2026-2022.csv";
const mdName = "common-order-checklist-2026-2022.md";
writeCsv(rows, path.join(outputDir, csvName));
writeMarkdown(rows, path.join(outputDir, mdName), csvName);

const xlsxOutputDir = path.join(ROOT, "outputs", "common-test-weekend-check-20260529");
fs.mkdirSync(xlsxOutputDir, { recursive: true });
const xlsxName = "共通テスト演習_本試験追試験_週末チェックリスト.xlsx";
writeXlsx(rows, path.join(xlsxOutputDir, xlsxName));

const subjectCount = rows.length;
const unorderedSubjectCount = rows.filter((row) => row.unorderedCount > 0).length;
const partialSubjectCount = rows.filter((row) => row.partialCount > 0).length;

console.log(`wrote docs/audit/${csvName}`);
console.log(`wrote docs/audit/${mdName}`);
console.log(`wrote outputs/common-test-weekend-check-20260529/${xlsxName}`);
console.log(`subjects: ${subjectCount}`);
console.log(`subjects with unordered rules: ${unorderedSubjectCount}`);
console.log(`subjects with partial-credit rules: ${partialSubjectCount}`);
