import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(process.cwd(), "..");
const retakeDir = path.join(rootDir, "common_retake");
const themesPath = path.join(process.cwd(), "src", "generated", "section-themes.json");
const themes = JSON.parse(fs.readFileSync(themesPath, "utf8"));
const years = ["2022", "2023", "2024", "2025", "2026"];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getThemeKeys(year, subject) {
  const prefix = `common_retake:${year}:${subject}:`;
  return Object.keys(themes).filter((key) => key.startsWith(prefix));
}

function summarizeMarksheet(marksheet) {
  const questions = marksheet.questions ?? [];
  const sections = new Set(
    questions
      .map((question) => question.sectionTitle || question.sectionId)
      .filter(Boolean),
  );

  return {
    questions: questions.length,
    sections: sections.size,
    points: questions.reduce((sum, question) => sum + (Number(question.points) || 0), 0),
  };
}

const rows = [];

for (const year of years) {
  const yearDir = path.join(retakeDir, year);
  if (!fs.existsSync(yearDir)) continue;

  for (const subject of fs.readdirSync(yearDir).sort()) {
    const subjectDir = path.join(yearDir, subject);
    const marksheetPath = path.join(subjectDir, "marksheet.json");
    const metadataPath = path.join(subjectDir, "metadata.json");
    if (!fs.existsSync(marksheetPath) || !fs.existsSync(metadataPath)) continue;

    const metadata = readJson(metadataPath);
    const marksheet = readJson(marksheetPath);
    const markSummary = summarizeMarksheet(marksheet);
    const themeKeys = getThemeKeys(year, subject);

    rows.push({
      year,
      subject,
      sourceKind: metadata.source?.kind ?? "none",
      questions: markSummary.questions,
      marksheetSections: markSummary.sections,
      totalPoints: markSummary.points,
      themeSections: themeKeys.length,
      themeSectionsWithPoints: themeKeys.filter((key) => typeof themes[key]?.points === "number").length,
    });
  }
}

const bySource = rows.reduce((acc, row) => {
  acc[row.sourceKind] = (acc[row.sourceKind] ?? 0) + 1;
  return acc;
}, {});

const completeRows = rows.filter((row) => row.themeSections > 0);
const pointBackedRows = rows.filter((row) => row.themeSectionsWithPoints > 0);
const sectionCompleteRows = rows.filter(
  (row) => row.marksheetSections > 0 && row.themeSections >= row.marksheetSections,
);

console.log(
  JSON.stringify(
    {
      totalSubjectYears: rows.length,
      sourceKindCounts: bySource,
      withRetakeThemes: completeRows.length,
      withPointBackedRetakeThemes: pointBackedRows.length,
      withCompleteThemesForMarksheetSections: sectionCompleteRows.length,
    },
    null,
    2,
  ),
);

console.log("year,subject,sourceKind,questions,marksheetSections,totalPoints,themeSections,themeSectionsWithPoints");
for (const row of rows) {
  console.log(
    [
      row.year,
      row.subject,
      row.sourceKind,
      row.questions,
      row.marksheetSections,
      row.totalPoints,
      row.themeSections,
      row.themeSectionsWithPoints,
    ].join(","),
  );
}
