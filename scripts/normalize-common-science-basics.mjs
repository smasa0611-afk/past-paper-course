import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const scienceYearsToCombine = [2022, 2023, 2024];
const examRoots = ["common", "common_retake"];
const basicScienceSubjects = [
  ["physics_basics", "\u7269\u7406\u57fa\u790e", "pb"],
  ["chemistry_basics", "\u5316\u5b66\u57fa\u790e", "cb"],
  ["biology_basics", "\u751f\u7269\u57fa\u790e", "bb"],
  ["earth_science_basics", "\u5730\u5b66\u57fa\u790e", "eb"],
];
const defaultChoices = [
  { value: "-", label: "-" },
  ...Array.from({ length: 10 }, (_, index) => ({ value: String(index), label: String(index) })),
  ...["a", "b", "c", "d", "e"].map((value) => ({ value, label: value })),
  ...["A", "B", "C", "D", "E"].map((value) => ({ value, label: value })),
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function allMarksheetPaths(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) allMarksheetPaths(entryPath, out);
    if (entry.isFile() && entry.name === "marksheet.json") out.push(entryPath);
  }
  return out;
}

function normalizeQuestionPoints(schema) {
  const ruleByQuestionId = new Map();
  for (const rule of schema.scoringRules ?? []) {
    const questionIds = rule.questionIds ?? [];
    if (!questionIds.length) continue;
    const totalPoints = Number(rule.points ?? 0);
    const sharedPoints = Number((totalPoints / questionIds.length).toFixed(4));
    let assignedPoints = 0;
    for (const [index, questionId] of questionIds.entries()) {
      const points =
        questionIds.length === 1 || index === questionIds.length - 1
          ? Number((totalPoints - assignedPoints).toFixed(4))
          : sharedPoints;
      assignedPoints += points;
      ruleByQuestionId.set(questionId, {
        points,
      });
    }
  }

  let changed = false;
  for (const question of schema.questions ?? []) {
    const rule = ruleByQuestionId.get(question.id);
    if (!rule) continue;
    if (question.points !== rule.points) {
      question.points = rule.points;
      changed = true;
    }
  }
  return changed;
}

function prefixedQuestionId(prefix, questionId) {
  const cleanId = String(questionId).replace(/^q_?/, "");
  return `${prefix}_${cleanId}`;
}

function copyPdfFiles(sourceDir, targetDir, files = [], labelPrefix) {
  return files
    .filter((file) => file?.path && fs.existsSync(path.join(sourceDir, file.path)))
    .map((file) => {
      const sourcePath = path.join(sourceDir, file.path);
      const targetPath = path.join(targetDir, file.path);
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.copyFileSync(sourcePath, targetPath);
      return {
        label: `${labelPrefix} ${file.label ?? ""}`.trim(),
        path: file.path,
      };
    });
}

function combineScienceBasics(rootName, year) {
  const rootDir = path.join(repoRoot, rootName, String(year));
  const targetDir = path.join(rootDir, "science_basics");
  const questions = [];
  const scoringRules = [];
  const problemFiles = [];
  const answerFiles = [];
  let nextQuestionNumber = 1;
  let nextRuleNumber = 1;
  let complete = true;

  fs.mkdirSync(targetDir, { recursive: true });

  for (const [subject, sectionTitle, prefix] of basicScienceSubjects) {
    const sourceDir = path.join(rootDir, subject);
    const marksheetPath = path.join(sourceDir, "marksheet.json");
    const metadataPath = path.join(sourceDir, "metadata.json");
    if (!fs.existsSync(marksheetPath) || !fs.existsSync(metadataPath)) {
      complete = false;
      continue;
    }

    const schema = readJson(marksheetPath);
    const metadata = readJson(metadataPath);
    problemFiles.push(...copyPdfFiles(sourceDir, targetDir, metadata.problem_files ?? [], sectionTitle));
    answerFiles.push(...copyPdfFiles(sourceDir, targetDir, metadata.answer_files ?? [], sectionTitle));

    const idMap = new Map();
    for (const question of schema.questions ?? []) {
      const newId = prefixedQuestionId(prefix, question.id);
      idMap.set(question.id, newId);
      questions.push({
        ...question,
        id: newId,
        number: nextQuestionNumber,
        prompt: sectionTitle,
        sectionId: subject,
        sectionTitle,
      });
      nextQuestionNumber += 1;
    }

    for (const rule of schema.scoringRules ?? []) {
      const mappedQuestionIds = (rule.questionIds ?? []).map((questionId) => idMap.get(questionId)).filter(Boolean);
      if (!mappedQuestionIds.length) continue;
      scoringRules.push({
        ...rule,
        id: `${prefix}_rule_${nextRuleNumber}`,
        title: `${sectionTitle} ${rule.title ?? mappedQuestionIds.join("/")}`,
        questionIds: mappedQuestionIds,
        sectionId: subject,
        sectionTitle,
      });
      nextRuleNumber += 1;
    }
  }

  if (!complete || !questions.length || !scoringRules.length) {
    throw new Error(`Cannot build ${rootName}/${year}/science_basics from the four basic science subjects.`);
  }

  const schema = {
    title: `\u5171\u901a\u30c6\u30b9\u30c8 \u7406\u79d1\u57fa\u790e ${year}${rootName === "common_retake" ? " \u8ffd\u8a66\u9a13" : ""}`,
    instructions: "\u53d7\u9a13\u3059\u308b\u57fa\u790e\u79d1\u76ee\u30922\u3064\u9078\u629e\u3057\u3001\u9078\u3093\u3060\u79d1\u76ee\u306e\u89e3\u7b54\u756a\u53f7\u3054\u3068\u306b\u30de\u30fc\u30af\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
    defaultChoices,
    choicesPerRow: 4,
    questions,
    scoringRules,
    selectionGroups: [
      {
        id: `science_basics_select_${rootName}_${year}`,
        title: "4\u79d1\u76ee\u304b\u30892\u79d1\u76ee\u9078\u629e",
        sectionIds: basicScienceSubjects.map(([subject]) => subject),
        minSelect: 2,
        maxSelect: 2,
      },
    ],
  };

  normalizeQuestionPoints(schema);
  writeJson(path.join(targetDir, "marksheet.json"), schema);
  writeJson(path.join(targetDir, "metadata.json"), {
    exam_type: rootName,
    year,
    subject: "science_basics",
    course: "",
    title: schema.title,
    time_minutes: 60,
    problem_files: problemFiles,
    answer_files: answerFiles,
  });
}

let normalized = 0;
for (const rootName of examRoots) {
  for (const year of scienceYearsToCombine) {
    combineScienceBasics(rootName, year);
  }
}

for (const rootName of examRoots) {
  for (const marksheetPath of allMarksheetPaths(path.join(repoRoot, rootName))) {
    const schema = readJson(marksheetPath);
    if (normalizeQuestionPoints(schema)) {
      writeJson(marksheetPath, schema);
      normalized += 1;
    }
  }
}

console.log(`Built combined science_basics marksheets for ${scienceYearsToCombine.length * examRoots.length} exams.`);
console.log(`Normalized question.points in ${normalized} marksheet files.`);
