import { NextResponse } from "next/server";
import path from "path";
import { getPasswordValidationError } from "@/lib/auth-validation";
import { hashPassword, verifyPassword } from "@/lib/passwords";
import { buildSessionCookieOptions, createSessionToken } from "@/lib/session";
import { isGeneratedNickname } from "@/lib/nicknames";
import { readStudentCourseEnrollments } from "@/lib/course-management-store";
import { readJsonFile, writeJsonFileAtomic } from "@/lib/json-file-store";
import { readStudents, writeStudents } from "@/lib/student-store";
import type { StudentGoal } from "@/types/admissions";

type StudentRecord = {
  id: string;
  name?: string;
  nickname?: string;
  email?: string;
  password?: string;
  initialPassword?: string;
  target?: string;
  campus?: string;
  grade?: string;
};

type SetupBody = {
  id?: string;
  initialPassword?: string;
  password?: string;
  nickname?: string;
  targetRate?: number;
};

const goalsPath = path.resolve(process.cwd(), "..", "data", "student_goals.json");

function externalPersistenceConfigured() {
  return Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.BLOB_READ_WRITE_TOKEN);
}

function saveInitialTargetRate(studentId: string, targetRate: number) {
  const goals = readJsonFile<StudentGoal[]>(goalsPath, []);
  const enrollments = readStudentCourseEnrollments().filter((enrollment) => enrollment.studentId === studentId);
  const goalEnrollment =
    enrollments.find((enrollment) => enrollment.goalUniversity || enrollment.goalFaculty || enrollment.goalDepartment) ??
    enrollments[0] ??
    null;
  const existingIndex = goals.findIndex((goal) => goal.studentId === studentId);

  if (existingIndex >= 0) {
    goals[existingIndex] = {
      ...goals[existingIndex],
      bRate: targetRate,
    };
    writeJsonFileAtomic(goalsPath, goals);
    return;
  }

  goals.push({
    id: `${studentId}-initial-goal`,
    studentId,
    admissionCode: `initial-${studentId}`,
    university: goalEnrollment?.goalUniversity ?? "",
    faculty: goalEnrollment?.goalFaculty ?? "",
    department: goalEnrollment?.goalDepartment ?? "",
    method: "",
    schedule: "",
    bRate: targetRate,
    createdAt: new Date().toISOString(),
  });
  writeJsonFileAtomic(goalsPath, goals);
}

export async function POST(req: Request) {
  try {
    const { id, initialPassword, password, nickname, targetRate } = (await req.json()) as SetupBody;
    const studentId = id?.trim();
    const submittedInitialPassword = initialPassword ?? "";
    const setupPassword = password ?? "";
    const selectedNickname = nickname?.trim() ?? "";
    const parsedTargetRate = Number(targetRate);

    if (!studentId) {
      return NextResponse.json({ error: "生徒IDを入力してください。" }, { status: 400 });
    }

    if (!/^\d{8}$/.test(studentId)) {
      return NextResponse.json({ error: "生徒IDは8桁の数字で入力してください。" }, { status: 400 });
    }

    const passwordError = getPasswordValidationError(setupPassword, studentId);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    if (!Number.isFinite(parsedTargetRate) || parsedTargetRate < 40 || parsedTargetRate > 100) {
      return NextResponse.json({ error: "共通テストの目標％は40〜100の範囲で入力してください。" }, { status: 400 });
    }

    if (!selectedNickname) {
      return NextResponse.json({ error: "ニックネーム候補を選択してください。" }, { status: 400 });
    }

    if (!isGeneratedNickname(selectedNickname)) {
      return NextResponse.json(
        { error: "末尾の数字は半角3桁で入力してください。" },
        { status: 400 },
      );
    }

    const students = (await readStudents()) as StudentRecord[];
    const index = students.findIndex((item) => item.id === studentId);
    if (index === -1) {
      return NextResponse.json({ error: "この生徒IDは登録されていません。" }, { status: 404 });
    }

    const student = students[index];
    if (student.password && student.nickname) {
      return NextResponse.json({ error: "この生徒IDは初回設定済みです。ログインしてください。" }, { status: 409 });
    }

    if (!verifyPassword(submittedInitialPassword, student.initialPassword)) {
      return NextResponse.json({ error: "IDまたは初期パスワードが正しくありません。" }, { status: 401 });
    }

    const nicknameUsed = students.some((item) => item.id !== studentId && item.nickname?.trim() === selectedNickname);
    if (nicknameUsed) {
      return NextResponse.json(
        { error: "このニックネームはすでに使われています。数字を変えるか、候補を更新してください。" },
        { status: 409 },
      );
    }

    const updatedStudents = [...students];
    updatedStudents[index] = {
      ...student,
      password: hashPassword(setupPassword),
      nickname: selectedNickname,
      initialPassword: "",
    };

    try {
      await writeStudents(updatedStudents);
      saveInitialTargetRate(studentId, parsedTargetRate);
    } catch (writeError) {
      if (externalPersistenceConfigured()) {
        throw writeError;
      }

      console.warn("Student setup persistence skipped for demo mode:", writeError);
    }

    const encodedToken = createSessionToken({ id: student.id, name: selectedNickname, role: "student" });
    const response = NextResponse.json({
      success: true,
      user: { id: student.id, name: selectedNickname, role: "student" },
    });
    response.cookies.set("session", encodedToken, buildSessionCookieOptions());
    return response;
  } catch (error) {
    console.error("Student setup error:", error);
    return NextResponse.json(
      { error: "初回設定に失敗しました。時間をおいてもう一度お試しください。" },
      { status: 500 },
    );
  }
}
