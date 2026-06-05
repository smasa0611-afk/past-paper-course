import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import exams from "@/generated/exams-index.json";
import { readMasterRecordsAsync } from "@/lib/master-data";
import { secondaryDummyExams } from "@/lib/secondary-dummy-exams";
import { listStoredSubmissions, writeSubmissionText } from "@/lib/submission-storage";
import { readAssignments, writeAssignments, type Assignment } from "@/lib/assignment-store";
import type { ExamMetadata } from "@/types/exam";
import { requireSession } from "@/lib/session";

type ImportFailure = {
  rowIndex: number;
  studentId: string;
  reason: string;
  examLabel?: string;
};

type ImportSuccess = {
  rowIndex: number;
  studentId: string;
  examId: string;
  examTitle: string;
  score: number;
  maxScore: number;
  submissionId: string;
  submittedAt: string;
  gradedAt: string;
  importedAt: string;
};

type ImportSkipped = {
  rowIndex: number;
  studentId: string;
  examId: string;
  examTitle: string;
  score: number;
  reason: string;
};

type ExamListItem = ExamMetadata & { id: string };

const studentsFilePath = path.resolve(process.cwd(), "data", "students.json");
const MASTER_STUDENT_ID_COLUMN = "生徒ＩＤ";

function safeReadJson<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function createAssignmentId(studentId: string, examId: string) {
  return `assignment-${studentId}-${examId.replaceAll("/", "-")}`;
}

function createImportedSubmissionId(studentId: string, examId: string, rowIndex: number) {
  const examToken = examId.replaceAll("/", "-");
  return `imported-${studentId}-${examToken}-${String(rowIndex + 1).padStart(3, "0")}`;
}

function toText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function toNumber(value: unknown) {
  const text = toText(value).replace(/,/g, "");
  if (!text) return undefined;
  const number = Number(text);
  return Number.isFinite(number) ? number : undefined;
}

function toDateIso(value: unknown, fallback: string) {
  const text = toText(value);
  if (!text) return fallback;
  const numeric = typeof value === "number" ? value : /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : null;
  if (numeric !== null && Number.isFinite(numeric) && numeric > 20000 && numeric < 80000) {
    const parsed = XLSX.SSF.parse_date_code(numeric);
    if (parsed) {
      const date = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d, parsed.H ?? 0, parsed.M ?? 0, Math.floor(parsed.S ?? 0)));
      return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
    }
  }
  const normalized = text.replace(/[./]/g, "-");
  const date = /^\d{4}-\d{1,2}-\d{1,2}$/.test(normalized)
    ? new Date(`${normalized}T00:00:00+09:00`)
    : new Date(normalized);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function normalizeHeader(value: unknown) {
  return toText(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()（）・_/-]/g, "");
}

function findColumn(headers: unknown[], aliases: string[]) {
  const normalizedAliases = aliases.map(normalizeHeader);
  return headers.findIndex((header) => normalizedAliases.includes(normalizeHeader(header)));
}

function getCell(row: unknown[], columnIndex: number | undefined) {
  if (columnIndex === undefined || columnIndex < 0) return "";
  return row[columnIndex];
}

function masterStudentId(record: Record<string, unknown>) {
  const direct = toText(record[MASTER_STUDENT_ID_COLUMN]);
  if (direct) return direct;
  const key = Object.keys(record).find((candidate) => normalizeHeader(candidate) === normalizeHeader("生徒ID"));
  return key ? toText(record[key]) : "";
}

function isEightDigitId(value: unknown) {
  return /^\d{8}$/.test(toText(value));
}

function readWorkbookFromUpload(buffer: Buffer, fileName: string) {
  if (/\.csv$/i.test(fileName)) {
    const text = new TextDecoder("shift_jis").decode(buffer);
    return XLSX.read(text, { type: "string", raw: false });
  }
  return XLSX.read(buffer, { type: "buffer", raw: false, codepage: 932 });
}

function normalizeExamLabel(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[()（）]/g, "")
    .replace(/年度/g, "年")
    .replace(/東京大学/g, "東大")
    .replace(/名古屋大学/g, "名大")
    .replace(/京都大学/g, "京大")
    .replace(/浜松医科大学/g, "浜松医科大")
    .replace(/英語/g, "英語")
    .replace(/数学/g, "数学");
}

function buildExamAliases(exam: ExamListItem) {
  const aliases = new Set<string>();
  const year = String(exam.year);
  const universityMap: Record<string, string[]> = {
    todai: ["東大", "東京大学"],
    kyodai: ["京大", "京都大学"],
    nagoya: ["名大", "名古屋大学"],
    hamamatsu_medical: ["浜松医科大", "浜松医科大学"],
  };
  const subjectMap: Record<string, string[]> = {
    math: ["数学"],
    english: ["英語"],
    physics: ["物理"],
    chemistry: ["化学"],
    biology: ["生物"],
  };
  const courseMap: Record<string, string[]> = {
    science: ["理系"],
    humanities: ["文系"],
  };

  aliases.add(normalizeExamLabel(exam.title));
  const universities = universityMap[exam.exam_type] ?? [exam.exam_type];
  const subjects = subjectMap[exam.subject] ?? [exam.subject];
  const courses = courseMap[exam.course] ?? [exam.course];

  universities.forEach((university) => {
    subjects.forEach((subject) => {
      aliases.add(normalizeExamLabel(`${year}年${university}${subject}`));
      aliases.add(normalizeExamLabel(`${university}${subject}${year}`));
      courses.forEach((course) => {
        aliases.add(normalizeExamLabel(`${year}年${university}${course}${subject}`));
        aliases.add(normalizeExamLabel(`${university}${course}${subject}${year}`));
      });
    });
  });

  return [...aliases].filter(Boolean);
}

function resolveExamByLabel(label: string, examList: ExamListItem[]) {
  const normalizedLabel = normalizeExamLabel(label);
  if (!normalizedLabel) return null;

  const ranked = examList
    .filter((exam) => exam.exam_type !== "common")
    .map((exam) => {
      const aliases = buildExamAliases(exam);
      const matched = aliases.some(
        (alias) => alias === normalizedLabel || alias.includes(normalizedLabel) || normalizedLabel.includes(alias),
      );
      const score = aliases.reduce((best, alias) => {
        if (alias === normalizedLabel) return Math.max(best, 1000 + alias.length);
        if (alias.includes(normalizedLabel) || normalizedLabel.includes(alias)) {
          return Math.max(best, Math.min(alias.length, normalizedLabel.length));
        }
        return best;
      }, matched ? 1 : 0);

      return { exam, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.exam ?? null;
}

function buildImportedContent(examTitle: string, score: number, maxScore: number) {
  return [
    "Imported score from external grading system.",
    `Exam: ${examTitle}`,
    `Score: ${score} / ${maxScore}`,
  ].join("\n");
}

export async function POST(req: Request) {
  try {
    const session = await requireSession("teacher");
    if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status });

    const formData = await req.formData();
    const file = formData.get("file");
    const defaultMaxScore = toNumber(formData.get("defaultMaxScore")) ?? 100;
    const fileLike = file as { arrayBuffer?: () => Promise<ArrayBuffer>; name?: string } | null;

    if (!fileLike || typeof fileLike.arrayBuffer !== "function") {
      return NextResponse.json({ error: "CSV file is required." }, { status: 400 });
    }

    const examList = [
      ...((exams as ExamListItem[]) ?? []),
      ...secondaryDummyExams.filter(
        (dummy) => !(exams as ExamListItem[]).some((exam) => exam.id === dummy.id),
      ),
    ];

    const arrayBuffer = await fileLike.arrayBuffer();
    const workbook = readWorkbookFromUpload(Buffer.from(arrayBuffer), fileLike.name ?? "");
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return NextResponse.json({ error: "No worksheet found in the uploaded file." }, { status: 400 });
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: "" });
    const dataRows = rows.filter((row) => Array.isArray(row) && row.some((cell) => toText(cell)));
    if (dataRows.length === 0) {
      return NextResponse.json({ error: "No rows found in the uploaded file." }, { status: 400 });
    }

    const firstRow = dataRows[0] ?? [];
    const secondRow = dataRows[1] ?? [];
    const knownSecondaryScoreCsv = firstRow.length >= 8 && !isEightDigitId(firstRow[0]) && isEightDigitId(secondRow[0]);
    const studentIdColumn = findColumn(firstRow, ["生徒ID", "studentId", "student_id"]);
    const courseNameColumn = findColumn(firstRow, ["講座名", "講座", "courseName", "course"]);
    const assignmentNameColumn = findColumn(firstRow, ["課題名", "課題", "assignmentName", "examName", "exam"]);
    const scoreColumn = findColumn(firstRow, ["点数", "得点", "score"]);
    const maxScoreColumn = findColumn(firstRow, ["満点", "配点", "maxScore", "max"]);
    const submittedAtColumn = findColumn(firstRow, ["提出日", "submittedAt", "submitted_at", "submittedDate"]);
    const gradedAtColumn = findColumn(firstRow, ["採点日", "gradedAt", "graded_at", "gradedDate"]);
    const effectiveStudentIdColumn = studentIdColumn >= 0 ? studentIdColumn : knownSecondaryScoreCsv ? 0 : -1;
    const effectiveCourseNameColumn = courseNameColumn >= 0 ? courseNameColumn : knownSecondaryScoreCsv ? 2 : -1;
    const effectiveAssignmentNameColumn = assignmentNameColumn >= 0 ? assignmentNameColumn : knownSecondaryScoreCsv ? 3 : -1;
    const effectiveScoreColumn = scoreColumn >= 0 ? scoreColumn : knownSecondaryScoreCsv ? 7 : -1;
    const effectiveMaxScoreColumn = maxScoreColumn >= 0 ? maxScoreColumn : -1;
    const effectiveSubmittedAtColumn = submittedAtColumn >= 0 ? submittedAtColumn : knownSecondaryScoreCsv ? 8 : -1;
    const effectiveGradedAtColumn = gradedAtColumn >= 0 ? gradedAtColumn : knownSecondaryScoreCsv ? 9 : -1;
    const normalizedFirstRow = firstRow.map((cell) => normalizeHeader(cell));
    const looksLikeHeader = knownSecondaryScoreCsv || effectiveStudentIdColumn >= 0 || effectiveScoreColumn >= 0 ||
      normalizedFirstRow.some((value) => value.includes("生徒id") || value === "studentid") ||
      normalizedFirstRow.some((value) => value.includes("点数") || value === "score");
    const targetRows = looksLikeHeader ? dataRows.slice(1) : dataRows;

    const students = safeReadJson<{ id: string }[]>(studentsFilePath, []);
    const masterStudentIds = (await readMasterRecordsAsync("students"))
      .filter((student) => student.is_active !== "false")
      .map((student) => masterStudentId(student))
      .filter(Boolean);
    const studentIdSet = new Set([...students.map((student) => String(student.id)), ...masterStudentIds]);
    const assignments = await readAssignments();
    const existingSubmissions = await listStoredSubmissions();
    const existingKeys = new Set(
      existingSubmissions.map((submission) => `${submission.studentId}|${submission.examId}|${submission.score ?? ""}`),
    );

    let imported = 0;
    let skipped = 0;
    let failed = 0;
    let createdAssignments = 0;
    const failures: ImportFailure[] = [];
    const importedRecords: ImportSuccess[] = [];
    const skippedRecords: ImportSkipped[] = [];
    const importTimestamp = new Date().toISOString();

    for (let index = 0; index < targetRows.length; index++) {
      const csvRowNumber = index + (looksLikeHeader ? 2 : 1);
      const row = targetRows[index] ?? [];
      const studentId = looksLikeHeader ? toText(getCell(row, effectiveStudentIdColumn)) : toText(row[0]);
      const examLabel = looksLikeHeader
        ? (toText(getCell(row, effectiveAssignmentNameColumn)) || toText(getCell(row, effectiveCourseNameColumn)))
        : toText(row[2]);
      const score = looksLikeHeader ? toNumber(getCell(row, effectiveScoreColumn)) : toNumber(row[3]);
      const maxScore = looksLikeHeader ? (toNumber(getCell(row, effectiveMaxScoreColumn)) ?? defaultMaxScore) : defaultMaxScore;
      const submittedAt = toDateIso(looksLikeHeader ? getCell(row, effectiveSubmittedAtColumn) : "", importTimestamp);
      const gradedAt = toDateIso(looksLikeHeader ? getCell(row, effectiveGradedAtColumn) : "", importTimestamp);

      if (!studentId) {
        failed++;
        failures.push({ rowIndex: csvRowNumber, studentId: "", reason: "生徒IDが空です。", examLabel });
        continue;
      }
      if (!studentIdSet.has(studentId)) {
        failed++;
        failures.push({ rowIndex: csvRowNumber, studentId, reason: "生徒IDがマスターに見つかりません。", examLabel });
        continue;
      }
      if (!examLabel) {
        failed++;
        failures.push({ rowIndex: csvRowNumber, studentId, reason: "課題名または講座名が空です。", examLabel });
        continue;
      }
      if (score === undefined) {
        failed++;
        failures.push({ rowIndex: csvRowNumber, studentId, reason: "点数が空、または数値として読めません。", examLabel });
        continue;
      }

      const exam = resolveExamByLabel(examLabel, examList);
      if (!exam) {
        failed++;
        failures.push({ rowIndex: csvRowNumber, studentId, reason: "課題名に対応する演習が見つかりません。", examLabel });
        continue;
      }

      const duplicateKey = `${studentId}|${exam.id}|${score}`;
      if (existingKeys.has(duplicateKey)) {
        skipped++;
        skippedRecords.push({
          rowIndex: csvRowNumber,
          studentId,
          examId: exam.id,
          examTitle: exam.title,
          score,
          reason: "同じ生徒・演習・点数の取り込み済みデータがあります。",
        });
        continue;
      }

      const existingAssignment = assignments.find(
        (assignment) => assignment.studentId === studentId && assignment.examId === exam.id,
      );
      const assignmentScore = {
        score,
        maxScore,
        submittedAt,
        gradedAt,
        importedAt: importTimestamp,
      };
      if (!existingAssignment) {
        assignments.push({
          id: createAssignmentId(studentId, exam.id),
          studentId,
          examId: exam.id,
          dueDate: submittedAt.slice(0, 10),
          ...assignmentScore,
        });
        createdAssignments++;
      } else {
        existingAssignment.dueDate = submittedAt.slice(0, 10);
        Object.assign(existingAssignment, assignmentScore);
      }

      const submissionId = createImportedSubmissionId(studentId, exam.id, index);
      const submission = {
        id: submissionId,
        examId: exam.id,
        studentId,
        content: buildImportedContent(exam.title, score, maxScore),
        images: [] as string[],
        timestamp: submittedAt,
        status: "graded",
        importedAt: importTimestamp,
      };
      const grade = {
        examId: exam.id,
        submissionId,
        score,
        maxScore,
        feedback: `Imported from CSV row ${index + 1}.`,
        gradedAt,
        sections: [],
      };

      await writeSubmissionText(exam.id, submissionId, "submission.json", JSON.stringify(submission, null, 2), "application/json");
      await writeSubmissionText(exam.id, submissionId, "grade.json", JSON.stringify(grade, null, 2), "application/json");
      existingKeys.add(duplicateKey);
      importedRecords.push({
        rowIndex: csvRowNumber,
        studentId,
        examId: exam.id,
        examTitle: exam.title,
        score,
        maxScore,
        submissionId,
        submittedAt,
        gradedAt,
        importedAt: importTimestamp,
      });
      imported++;
    }

    await writeAssignments(assignments);

    return NextResponse.json({
      imported,
      skipped,
      failed,
      createdAssignments,
      failures,
      importedRecords,
      skippedRecords,
    });
  } catch (error) {
    console.error("import-secondary-scores error:", error);
    return NextResponse.json({
      error: "Failed to import secondary scores.",
      details: [error instanceof Error ? error.message : String(error)],
    }, { status: 500 });
  }
}
