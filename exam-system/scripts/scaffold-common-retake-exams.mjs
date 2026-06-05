import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..", "..");
const commonRoot = path.join(rootDir, "common");
const retakeRoot = path.join(rootDir, "common_retake");

const retakeYears = [2026, 2025, 2024, 2023, 2022];

const officialPages = {
  2026: {
    problem: "https://www.dnc.ac.jp/kyotsu/shiken_jouhou/r8/index.html",
    answer: "https://www.dnc.ac.jp/kyotsu/shiken_jouhou/r8/r8_tuisaisiken_seikai.html",
  },
  2025: {
    problem: "https://www.dnc.ac.jp/kyotsu/kakomondai/r7/r7_tuisaishiken_mondai.html",
    answer: "https://www.dnc.ac.jp/kyotsu/kakomondai/r7/r7_tuisaisiken_seikai.html",
  },
  2024: {
    problem: "https://www.dnc.ac.jp/kyotsu/kakomondai/r6/r6_tuisaishiken_mondai.html",
    answer: "https://www.dnc.ac.jp/kyotsu/kakomondai/r6/r6_tuisaisiken_seikai.html",
  },
  2023: {
    problem: "https://www.dnc.ac.jp/kyotsu/kakomondai/r5/r5_tuisaishiken_mondai.html",
    answer: "https://www.dnc.ac.jp/kyotsu/kakomondai/r5/r5_tuisaisiken_seikai.html",
  },
  2022: {
    problem: "https://www.dnc.ac.jp/kyotsu/kako_shiken_jouhou/r4/",
    answer: "https://www.dnc.ac.jp/kyotsu/kako_shiken_jouhou/r4/",
  },
};

const titleSuffix = " 追試験";

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writePlaceholderPdf(filePath, lines) {
  ensureDir(path.dirname(filePath));
  const escaped = lines.map((line) => line.replace(/[()\\]/g, "\\$&"));
  const textCommands = escaped
    .map((line, index) => `${index === 0 ? "0 0 Td" : "0 -24 Td"} (${line}) Tj`)
    .join("\n");
  const body = [
    "%PDF-1.4",
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj",
    `4 0 obj << /Length ${textCommands.length + 36} >> stream`,
    "BT /F1 14 Tf 72 760 Td",
    textCommands,
    "ET",
    "endstream endobj",
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    "xref",
    "0 6",
    "0000000000 65535 f ",
    "trailer << /Root 1 0 R /Size 6 >>",
    "startxref",
    "0",
    "%%EOF",
  ].join("\n");
  fs.writeFileSync(filePath, body);
}

function copyIfExists(source, destination) {
  if (!fs.existsSync(source)) return false;
  ensureDir(path.dirname(destination));
  fs.copyFileSync(source, destination);
  return true;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, payload) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function buildRetakeMetadata(baseMetadata, year, subject, hasPlaceholderProblem) {
  const pages = officialPages[year] ?? {};
  return {
    ...baseMetadata,
    exam_type: "common_retake",
    year,
    subject,
    title: `${baseMetadata.title}${titleSuffix}`,
    source: {
      kind: hasPlaceholderProblem ? "placeholder" : "official",
      problem_url: pages.problem,
      answer_url: pages.answer,
      note: hasPlaceholderProblem
        ? "Official retake PDFs are not bundled yet. Replace problem.pdf and answer.pdf when the source PDF is available."
        : "Retake exercise scaffolded from the official DNC retake source pages.",
    },
  };
}

function buildRubric(metadata) {
  return [
    `# 採点基準: ${metadata.title}`,
    "",
    "## 採点の考え方",
    "- 追・再試験の正解PDFを取得後、marksheet.json の正解定義を追試験用に更新してください。",
    "- 現時点では本試験と同じマークシート形式を初期値として配置しています。",
    "- 問題PDFと解答PDFは problem.pdf / answer.pdf として参照されます。",
    "",
  ].join("\n");
}

function main() {
  const created = [];

  for (const year of retakeYears) {
    const sourceYearDir = path.join(commonRoot, String(year));
    if (!fs.existsSync(sourceYearDir)) continue;

    for (const subject of fs.readdirSync(sourceYearDir)) {
      const sourceSubjectDir = path.join(sourceYearDir, subject);
      const metadataPath = path.join(sourceSubjectDir, "metadata.json");
      if (!fs.existsSync(metadataPath)) continue;

      const targetSubjectDir = path.join(retakeRoot, String(year), subject);
      ensureDir(targetSubjectDir);

      const problemPath = path.join(targetSubjectDir, "problem.pdf");
      const answerPath = path.join(targetSubjectDir, "answer.pdf");
      const copiedProblem =
        fs.existsSync(problemPath) ||
        copyIfExists(
          path.join(targetSubjectDir, "_official_problem.pdf"),
          problemPath,
        );
      const copiedAnswer =
        fs.existsSync(answerPath) ||
        copyIfExists(
          path.join(targetSubjectDir, "_official_answer.pdf"),
          answerPath,
        );

      if (!copiedProblem) {
        writePlaceholderPdf(problemPath, [
          "Retake problem PDF placeholder",
          `common_retake/${year}/${subject}`,
          "Replace with the official retake problem PDF.",
        ]);
      }
      if (!copiedAnswer) {
        writePlaceholderPdf(answerPath, [
          "Retake answer PDF placeholder",
          `common_retake/${year}/${subject}`,
          "Replace with the official retake answer PDF.",
        ]);
      }

      copyIfExists(path.join(sourceSubjectDir, "marksheet.json"), path.join(targetSubjectDir, "marksheet.json"));

      const metadata = buildRetakeMetadata(readJson(metadataPath), year, subject, !copiedProblem);
      writeJson(path.join(targetSubjectDir, "metadata.json"), metadata);
      fs.writeFileSync(path.join(targetSubjectDir, "rubric.md"), buildRubric(metadata), "utf8");
      created.push(`common_retake/${year}/${subject}`);
    }
  }

  console.log(JSON.stringify({ created: created.length, first: created.slice(0, 5) }, null, 2));
}

main();
