import { NextResponse } from "next/server";
import { getPasswordValidationError } from "@/lib/auth-validation";
import { hashPassword, verifyPassword } from "@/lib/passwords";
import { buildSessionCookieOptions, createSessionToken } from "@/lib/session";
import { readTeachers, writeTeachers } from "@/lib/teacher-store";

type SetupBody = {
  id?: string;
  initialPassword?: string;
  password?: string;
};

function externalPersistenceConfigured() {
  return Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.BLOB_READ_WRITE_TOKEN);
}

export async function POST(req: Request) {
  try {
    const { id, initialPassword, password } = (await req.json()) as SetupBody;
    const teacherId = id?.trim() ?? "";
    const submittedInitialPassword = initialPassword ?? "";
    const setupPassword = password ?? "";

    if (!/^\d{8}$/.test(teacherId)) {
      return NextResponse.json({ error: "社員IDは8桁の数字で入力してください。" }, { status: 400 });
    }

    const passwordError = getPasswordValidationError(setupPassword, teacherId);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    const teachers = await readTeachers();
    const index = teachers.findIndex((item) => item.id === teacherId);
    if (index === -1) {
      return NextResponse.json({ error: "この社員IDは登録されていません。" }, { status: 404 });
    }

    const teacher = teachers[index];
    if (teacher.password) {
      return NextResponse.json({ error: "この社員IDは初回設定済みです。ログインしてください。" }, { status: 409 });
    }

    if (!verifyPassword(submittedInitialPassword, teacher.initialPassword)) {
      return NextResponse.json({ error: "IDまたは初期パスワードが正しくありません。" }, { status: 401 });
    }

    const updatedTeachers = [...teachers];
    updatedTeachers[index] = {
      ...teacher,
      password: hashPassword(setupPassword),
      initialPassword: "",
    };

    try {
      await writeTeachers(updatedTeachers);
    } catch (writeError) {
      if (externalPersistenceConfigured()) {
        throw writeError;
      }

      console.warn("Teacher setup persistence skipped for demo mode:", writeError);
    }

    const response = NextResponse.json({
      success: true,
      user: { id: teacher.id, name: teacher.name, role: "teacher" },
    });
    response.cookies.set(
      "session",
      createSessionToken({ id: teacher.id, name: teacher.name, role: "teacher" }),
      buildSessionCookieOptions(),
    );
    return response;
  } catch (error) {
    console.error("Teacher setup error:", error);
    return NextResponse.json({ error: "初回設定に失敗しました。" }, { status: 500 });
  }
}
