import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import type { AdmissionRecord, StudentGoal } from "@/types/admissions";
import { writeJsonFileAtomic } from "@/lib/json-file-store";
import { requireSession } from "@/lib/session";

const rootDataDir = process.cwd();
const studentsFilePath = path.join(rootDataDir, "data", "students.json");
const admissionsFilePath = path.join(rootDataDir, "data", "admissions", "2026_common_admissions.json");
const goalsFilePath = path.join(rootDataDir, "data", "student_goals.json");
const STUDENT_ID_COL_INDEX = 3; // D列
const GOAL_COL_INDEX = 5; // F列

type ImportFailure = {
  rowIndex: number; // 0-based row index in the imported worksheet. -1 means aggregated/latest-row import.
  studentId: string;
  reason: string;
};

function toHiragana(text: string) {
  return text.replace(/[\u30a1-\u30f6]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60));
}

function normalizeJapaneseText(text: string) {
  return toHiragana(
    text
      .normalize("NFKC")
      .replace(/東京科学大学/g, "東京工業大学")
      .replace(/東京科学大/g, "東京工業大")
      .replace(/情報理工学院/g, "情報理工学部")
      .replace(/[\s/・･()（）-]+/g, "")
      .toLowerCase(),
  );
}

function buildGoalVariants(goalText: string) {
  const base = normalizeJapaneseText(goalText);
  const variants = new Set<string>([base]);
  variants.add(base.replace(/全学科学科|全学科|学部共通学科|学部共通/g, ""));
  variants.add(base.replace(/高度工学教育|創造工学教育/g, ""));
  variants.add(base.replace(/学部|学科/g, ""));
  return [...variants].filter(Boolean);
}

function longestContainedSubstringLength(goalVariant: string, candidate: string) {
  let best = 0;
  for (let start = 0; start < candidate.length; start++) {
    for (let end = candidate.length; end > start + best; end--) {
      const part = candidate.slice(start, end);
      if (part.length <= best) break;
      if (goalVariant.includes(part)) {
        best = part.length;
        break;
      }
    }
  }
  return best;
}

function scoreTextMatch(goalVariants: string[], candidateText: string) {
  const normalizedCandidate = normalizeJapaneseText(candidateText);
  if (!normalizedCandidate) return 0;

  let best = 0;
  for (const variant of goalVariants) {
    if (!variant) continue;
    if (variant.includes(normalizedCandidate)) {
      best = Math.max(best, 1000 + normalizedCandidate.length);
      continue;
    }

    best = Math.max(best, longestContainedSubstringLength(variant, normalizedCandidate));
  }

  return best;
}

function collectBestMatches<T>(items: T[], getText: (item: T) => string) {
  return (goalVariants: string[]) => {
    let bestScore = 0;
    let bestItems: T[] = [];

    for (const item of items) {
      const score = scoreTextMatch(goalVariants, getText(item));
      if (score <= 0) continue;

      if (score > bestScore) {
        bestScore = score;
        bestItems = [item];
      } else if (score === bestScore) {
        bestItems.push(item);
      }
    }

    return { bestScore, bestItems };
  };
}

function buildManualGoalParts(goalText: string) {
  const parts = goalText
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    university: parts[0] ?? goalText,
    faculty: parts[1] ?? "",
    department: parts.slice(2).join(" "),
  };
}

function toCellString(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    const n = Number.isFinite(value) ? Math.trunc(value) : value;
    return String(n);
  }

  return String(value).replace(/\.0$/, "").trim();
}

function safeReadJson<T>(filePath: string, defaultValue: T): T {
  try {
    if (!fs.existsSync(filePath)) return defaultValue;
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch {
    return defaultValue;
  }
}

function chooseAdmissionRecord(candidates: AdmissionRecord[]) {
  const schedulePref = ["前", "中", "後", "共"] as const;
  const scheduleFound = schedulePref.find((schedule) =>
    candidates.some((candidate) => candidate.schedule === schedule),
  );
  const scheduleCandidates = scheduleFound
    ? candidates.filter((candidate) => candidate.schedule === scheduleFound)
    : candidates;

  const emptyMethodCandidates = scheduleCandidates.filter(
    (candidate) => !candidate.method || candidate.method.trim().length === 0,
  );
  const methodCandidates =
    emptyMethodCandidates.length > 0 ? emptyMethodCandidates : scheduleCandidates;

  return [...methodCandidates].sort((a, b) => b.bRate - a.bRate)[0];
}

function findBestAdmissionFromGoalText(admissions: AdmissionRecord[], goalText: string) {
  const goalVariants = buildGoalVariants(goalText);
  if (goalVariants.length === 0) {
    return { admission: null as AdmissionRecord | null, university: "", faculty: "", department: "" };
  }

  const uniqueUniversities = Array.from(new Set(admissions.map((admission) => admission.university).filter(Boolean)));
  const universityMatcher = collectBestMatches(uniqueUniversities, (university) => university);
  const { bestScore: universityScore, bestItems: universityMatches } = universityMatcher(goalVariants);
  const bestUniversity = universityMatches[0] ?? "";
  if (!bestUniversity || universityScore < 2) {
    return { admission: null as AdmissionRecord | null, university: "", faculty: "", department: "" };
  }

  const inUniversity = admissions.filter((admission) => admission.university === bestUniversity);

  const uniqueFaculties = Array.from(new Set(inUniversity.map((admission) => admission.faculty).filter(Boolean)));
  const facultyMatcher = collectBestMatches(uniqueFaculties, (faculty) => faculty);
  const { bestScore: facultyScore, bestItems: facultyMatches } = facultyMatcher(goalVariants);
  const bestFaculty = facultyMatches[0] ?? "";
  if (!bestFaculty || facultyScore < 2) {
    return { admission: null as AdmissionRecord | null, university: bestUniversity, faculty: "", department: "" };
  }

  const inFaculty = inUniversity.filter((admission) => admission.faculty === bestFaculty);
  const departmentMatcher = collectBestMatches(inFaculty, (admission) => admission.department);
  const { bestScore: departmentScore, bestItems: departmentMatches } = departmentMatcher(goalVariants);
  const bestDepartment = departmentMatches[0]?.department ?? "";

  const departmentCandidates =
    departmentScore >= 2 && departmentMatches.length > 0
      ? departmentMatches
      : inFaculty;

  if (departmentCandidates.length === 0) {
    return {
      admission: null as AdmissionRecord | null,
      university: bestUniversity,
      faculty: bestFaculty,
      department: bestDepartment,
    };
  }

  return {
    admission: chooseAdmissionRecord(departmentCandidates),
    university: bestUniversity,
    faculty: bestFaculty,
    department: bestDepartment,
  };
}

export async function POST(req: Request) {
  try {
    const session = await requireSession("teacher");
    if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status });

    const formData = await req.formData();
    const file = formData.get("file");
    const fileLike = file as { arrayBuffer?: () => Promise<ArrayBuffer> } | null;
    if (!fileLike || typeof fileLike.arrayBuffer !== "function") {
      return NextResponse.json({ error: "xlsxファイルを指定してください。" }, { status: 400 });
    }

    const arrayBuffer = await fileLike.arrayBuffer();
    const workbook = XLSX.read(Buffer.from(arrayBuffer), { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return NextResponse.json({ error: "シートが見つかりません。" }, { status: 400 });
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }) as unknown[][];
    if (!rows.length) {
      return NextResponse.json({ error: "Excelの中身が空です。" }, { status: 400 });
    }

    const headerRow = rows[0] ?? [];
    if (headerRow.length <= GOAL_COL_INDEX) {
      return NextResponse.json(
        {
          error: "Excelの列数が不足しています。D列に生徒ID、F列に志望校がある形式を用意してください。",
          header: headerRow,
        },
        { status: 400 },
      );
    }

    const students = safeReadJson<{ id: string }[]>(studentsFilePath, []);
    const studentIdSet = new Set(students.map((student) => String(student.id)));

    const admissions = safeReadJson<AdmissionRecord[]>(admissionsFilePath, []);
    if (!admissions.length) {
      return NextResponse.json({ error: "admissionsデータが見つかりません。" }, { status: 500 });
    }

    const goalsExisting = safeReadJson<StudentGoal[]>(goalsFilePath, []);
    const latestGoalRowByStudent = new Map<string, { rowIndex: number; goalText: string }>();

    // D列の生徒IDごとに、最後に出てきたF列の志望校を採用する。
    for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex] ?? [];
      const studentId = toCellString(row[STUDENT_ID_COL_INDEX]);
      const goalText = toCellString(row[GOAL_COL_INDEX]);
      if (!studentId || !goalText) continue;

      latestGoalRowByStudent.set(studentId, { rowIndex, goalText });
    }

    const matchedStudentIds = [...latestGoalRowByStudent.keys()].filter((studentId) =>
      studentIdSet.has(studentId),
    );
    if (latestGoalRowByStudent.size > 0 && matchedStudentIds.length === 0) {
      return NextResponse.json(
        {
          error:
            "Excel内の生徒IDが、現在のシステムの生徒データと1件も一致しません。デモ生徒と志望校リストのIDが別データになっています。",
          totalUniqueStudentIds: latestGoalRowByStudent.size,
          sampleStudentIds: [...latestGoalRowByStudent.keys()].slice(0, 10),
        },
        { status: 400 },
      );
    }

    let imported = 0;
    let updated = 0;
    let failed = 0;
    const failures: ImportFailure[] = [];
    const nextGoals = goalsExisting.filter((goal) => !latestGoalRowByStudent.has(goal.studentId));

    for (const [studentId, latestGoal] of latestGoalRowByStudent.entries()) {
      if (!studentIdSet.has(studentId)) {
        failed++;
        if (failures.length < 20) {
          failures.push({
            rowIndex: latestGoal.rowIndex,
            studentId,
            reason: "students.jsonにstudentIdが存在しません。",
          });
        }
        continue;
      }

      const hadExistingGoal = goalsExisting.some((goal) => goal.studentId === studentId);
      const { admission } = findBestAdmissionFromGoalText(admissions, latestGoal.goalText);
      const manualGoalParts = !admission ? buildManualGoalParts(latestGoal.goalText) : null;
      nextGoals.push({
        id: `${studentId}-${admission?.code ?? "manual-goal"}`,
        studentId,
        admissionCode: admission?.code ?? `manual-${studentId}`,
        university: admission?.university ?? manualGoalParts?.university ?? latestGoal.goalText,
        faculty: admission?.faculty ?? manualGoalParts?.faculty ?? "",
        department: admission?.department ?? manualGoalParts?.department ?? "",
        method: admission?.method ?? "",
        schedule: admission?.schedule ?? "",
        bRate: admission?.bRate ?? 75,
        createdAt: new Date().toISOString(),
      });

      if (hadExistingGoal) {
        updated++;
      } else {
        imported++;
      }
    }

    writeJsonFileAtomic(goalsFilePath, nextGoals);

    return NextResponse.json({
      imported,
      updated,
      skipped: 0,
      failed,
      failures,
    });
  } catch (error) {
    console.error("import-student-goals error:", error);
    return NextResponse.json({ error: "取り込み処理に失敗しました。" }, { status: 500 });
  }
}
