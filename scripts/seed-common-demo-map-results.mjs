import fs from "fs";
import path from "path";

const root = process.cwd();
const outputRoot = path.join(root, "local-data", "submissions");

const demoStudents = ["10000002", "10000003", "10000004", "10000005", "10000006"];
const years = [2026, 2025];
const tableSubjects = [
  "english",
  "english_listening",
  "math_ia",
  "math_iibc",
  "japanese",
  "biology",
  "chemistry",
  "geography",
  "public_ethics",
  "information_i",
];

const mainRates = {
  "10000002": [0.73, 0.66, 0.82, 0.58, 0.64, 0.76, 0.61, 0.69, 0.72, 0.67],
  "10000003": [0.62, 0.70, 0.59, 0.66, 0.72, 0.63, 0.78, 0.57, 0.68, 0.74],
  "10000004": [0.81, 0.75, 0.69, 0.71, 0.58, 0.65, 0.72, 0.79, 0.61, 0.70],
  "10000005": [0.68, 0.72, 0.74, 0.63, 0.77, 0.59, 0.66, 0.71, 0.64, 0.73],
  "10000006": [0.57, 0.64, 0.70, 0.61, 0.69, 0.73, 0.58, 0.66, 0.75, 0.62],
};

const retakeRateBumps = [0.08, 0.15, 0.21];
const repeatedMainPatterns = [
  {
    year: 2026,
    subject: "biology",
    rates: [0.5, 0.64, 0.77],
  },
  {
    year: 2026,
    subject: "public_ethics",
    rates: [0.56, 0.72],
  },
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
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

function matchesRule(rule, actual) {
  return (rule.acceptedVariants ?? []).some((variant) => matchesVariant(variant, actual, rule.orderMatters !== false));
}

function awardedPoints(rule, actual) {
  if (matchesRule(rule, actual)) return rule.points;
  const partial = (rule.partialCredit ?? []).find((entry) =>
    (entry.acceptedVariants ?? []).some((variant) => matchesVariant(variant, actual, entry.orderMatters ?? rule.orderMatters !== false)),
  );
  return partial?.points ?? 0;
}

function fallbackRules(schema) {
  return (schema.questions ?? [])
    .filter((question) => String(question.correctAnswer ?? "").trim().length > 0)
    .map((question) => ({
      id: question.id,
      title: question.prompt,
      questionIds: [question.id],
      acceptedVariants: [[String(question.correctAnswer)]],
      points: question.points ?? 1,
      sectionId: question.sectionId,
    }));
}

function effectiveRules(schema) {
  const explicitRules = schema.scoringRules ?? [];
  if (!explicitRules.length) return fallbackRules(schema);
  const covered = new Set(explicitRules.flatMap((rule) => rule.questionIds));
  return [...explicitRules, ...fallbackRules(schema).filter((rule) => !rule.questionIds.some((questionId) => covered.has(questionId)))];
}

function selectedSectionIds(schema) {
  const selected = new Set();
  for (const group of schema.selectionGroups ?? []) {
    const count = group.minSelect ?? group.maxSelect ?? group.sectionIds.length;
    group.sectionIds.slice(0, count).forEach((sectionId) => selected.add(sectionId));
  }
  return [...selected];
}

function activeQuestionIds(schema, selectedIds) {
  const selectable = new Set((schema.selectionGroups ?? []).flatMap((group) => group.sectionIds));
  const selected = new Set(selectedIds);
  return new Set(
    (schema.questions ?? [])
      .filter((question) => !question.sectionId || !selectable.has(question.sectionId) || selected.has(question.sectionId))
      .map((question) => question.id),
  );
}

function makeWrongValues(rule, questionsById) {
  const candidates = ["0", "9", "8", "7", "6", "5", "4", "3", "2", "1", "-"];
  for (const candidate of candidates) {
    const actual = rule.questionIds.map(() => candidate);
    if (!matchesRule(rule, actual) && awardedPoints(rule, actual) === 0) return actual;
  }
  return rule.questionIds.map((questionId) => {
    const choices = questionsById.get(questionId)?.choices ?? [];
    return choices.find((choice) => !String(choice.value).includes("*"))?.value ?? "0";
  });
}

function buildAttempt(schema, targetRate, salt) {
  const selectedIds = selectedSectionIds(schema);
  const activeIds = activeQuestionIds(schema, selectedIds);
  const questionsById = new Map((schema.questions ?? []).map((question) => [question.id, question]));
  const rules = effectiveRules(schema).filter((rule) => rule.questionIds.every((questionId) => activeIds.has(questionId)));
  const maxScore = rules.reduce((sum, rule) => sum + rule.points, 0);
  const targetScore = Math.round(maxScore * targetRate);
  const answers = {};
  const sortedRules = [...rules].sort((a, b) => {
    const aWeight = ((a.id.length + salt) * 17) % 31;
    const bWeight = ((b.id.length + salt) * 17) % 31;
    return aWeight - bWeight || b.points - a.points;
  });
  let score = 0;

  for (const rule of sortedRules) {
    const correct = rule.acceptedVariants?.[0] ?? [];
    const required = rule.requires ?? [];
    const canAdd = score + rule.points <= targetScore || targetScore - score >= rule.points / 2;
    const actual = canAdd ? correct : makeWrongValues(rule, questionsById);
    if (canAdd) {
      required.forEach((requirement) => {
        answers[requirement.questionId] = requirement.value;
      });
    }
    rule.questionIds.forEach((questionId, index) => {
      answers[questionId] = String(actual[index] ?? actual[0] ?? "");
    });
    const prerequisitesMet = required.every((requirement) => answers[requirement.questionId] === requirement.value);
    score += prerequisitesMet ? awardedPoints(rule, rule.questionIds.map((questionId) => answers[questionId] ?? "")) : 0;
  }

  for (const question of schema.questions ?? []) {
    if (!activeIds.has(question.id)) continue;
    if (!Object.hasOwn(answers, question.id)) answers[question.id] = "";
  }

  const finalScore = rules.reduce((sum, rule) => {
    const prerequisitesMet = (rule.requires ?? []).every((requirement) => answers[requirement.questionId] === requirement.value);
    const actual = rule.questionIds.map((questionId) => answers[questionId] ?? "");
    return sum + (prerequisitesMet ? awardedPoints(rule, actual) : 0);
  }, 0);

  return {
    payload: {
      mode: "marksheet",
      answers,
      selectedSectionIds: selectedIds,
    },
    score: finalScore,
    maxScore,
    sections: buildGradeSections(schema, rules, answers),
  };
}

function getQuestionSection(question, index) {
  const title = question.sectionTitle || `第${Math.floor(index / 6) + 1}問`;
  return { id: question.sectionId || title, title };
}

function buildGradeSections(schema, rules, answers) {
  const questionIndex = new Map((schema.questions ?? []).map((question, index) => [question.id, { question, index }]));
  const sections = new Map();
  for (const rule of rules) {
    const first = questionIndex.get(rule.questionIds[0]);
    if (!first) continue;
    const section = rule.sectionId ? { id: rule.sectionId, title: first.question.sectionTitle || rule.title || rule.sectionId } : getQuestionSection(first.question, first.index);
    const current = sections.get(section.id) ?? {
      id: section.id,
      title: section.title,
      score: 0,
      maxScore: 0,
      feedback: "",
      retryRecommended: false,
    };
    const actual = rule.questionIds.map((questionId) => answers[questionId] ?? "");
    const prerequisitesMet = (rule.requires ?? []).every((requirement) => answers[requirement.questionId] === requirement.value);
    current.score += prerequisitesMet ? awardedPoints(rule, actual) : 0;
    current.maxScore += rule.points;
    sections.set(section.id, current);
  }
  return [...sections.values()].map((section) => ({
    ...section,
    feedback: section.maxScore > 0 && section.score / section.maxScore < 0.6 ? "Retake practice priority." : "Answer pattern is stable.",
    retryRecommended: section.maxScore > 0 && section.score / section.maxScore < 0.6,
  }));
}

function seedSubmission({ examRoot, year, subject, studentId, attemptIndex, rate, timestamp }) {
  const examId = `${examRoot}/${year}/${subject}`;
  const marksheetPath = path.join(root, examRoot, String(year), subject, "marksheet.json");
  if (!fs.existsSync(marksheetPath)) return false;

  const schema = readJson(marksheetPath);
  const attempt = buildAttempt(schema, rate, year + subject.length + attemptIndex + Number(studentId.slice(-2)));
  if (attempt.maxScore <= 0) return false;

  const id = `demo-${studentId}-${examRoot.replace("/", "-")}-${year}-${subject}-${String(attemptIndex + 1).padStart(2, "0")}`;
  const dir = path.join(outputRoot, examRoot, String(year), subject, id);
  const submission = {
    id,
    examId,
    studentId,
    content: JSON.stringify(attempt.payload, null, 2),
    images: [],
    timestamp,
    status: "graded",
    score: attempt.score,
    maxScore: attempt.maxScore,
    feedback: "Demo marksheet graded result generated from question-level answers.",
    gradedAt: new Date(new Date(timestamp).getTime() + 18 * 60 * 1000).toISOString(),
  };
  const grade = {
    examId,
    submissionId: id,
    score: attempt.score,
    maxScore: attempt.maxScore,
    feedback: submission.feedback,
    gradedAt: submission.gradedAt,
    sections: attempt.sections,
  };
  writeJson(path.join(dir, "submission.json"), submission);
  writeJson(path.join(dir, "grade.json"), grade);
  return true;
}

let created = 0;

for (const [studentIndex, studentId] of demoStudents.entries()) {
  for (const [yearIndex, year] of years.entries()) {
    for (const [subjectIndex, subject] of tableSubjects.entries()) {
      const baseRate = mainRates[studentId][subjectIndex] - yearIndex * 0.04 + ((studentIndex + subjectIndex) % 3) * 0.015;
      const timestamp = new Date(Date.UTC(2026, 5, 1 + subjectIndex, 1 + studentIndex + yearIndex, subjectIndex * 4)).toISOString();
      if (seedSubmission({ examRoot: "common", year, subject, studentId, attemptIndex: 0, rate: Math.min(0.9, Math.max(0.45, baseRate)), timestamp })) {
        created += 1;
      }

      const retakeAttempts = subjectIndex % 3 === 0 ? 3 : 2;
      for (let attemptIndex = 0; attemptIndex < retakeAttempts; attemptIndex += 1) {
        const retakeRate = Math.min(0.92, Math.max(0.5, baseRate + retakeRateBumps[attemptIndex]));
        const retakeTimestamp = new Date(Date.UTC(2026, 5, 1 + subjectIndex, 8 + studentIndex + yearIndex, attemptIndex * 12)).toISOString();
        if (seedSubmission({ examRoot: "common_retake", year, subject, studentId, attemptIndex, rate: retakeRate, timestamp: retakeTimestamp })) {
          created += 1;
        }
      }
    }
  }
}

for (const [studentIndex, studentId] of demoStudents.entries()) {
  for (const pattern of repeatedMainPatterns) {
    pattern.rates.forEach((rate, attemptIndex) => {
      const timestamp = new Date(Date.UTC(2026, 5, 18 + attemptIndex, 2 + studentIndex, attemptIndex * 10)).toISOString();
      if (seedSubmission({ examRoot: "common", year: pattern.year, subject: pattern.subject, studentId, attemptIndex, rate, timestamp })) {
        created += 1;
      }
    });
  }
}

console.log(`Created or updated ${created} demo common-test submissions.`);
