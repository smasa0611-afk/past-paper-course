import { NextResponse } from "next/server";
import { getPasswordValidationError } from "@/lib/auth-validation";
import { hashPassword, verifyPassword } from "@/lib/passwords";
import { requireSession } from "@/lib/session";
import { readStudents, writeStudents } from "@/lib/student-store";

type PasswordChangeBody = {
  currentPassword?: string;
  newPassword?: string;
};

export async function PUT(req: Request) {
  try {
    const session = await requireSession("student");
    if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status });

    const { currentPassword = "", newPassword = "" } = (await req.json()) as PasswordChangeBody;
    const passwordError = getPasswordValidationError(newPassword, session.user.id);
    if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });

    const students = await readStudents();
    const index = students.findIndex((student) => student.id === session.user.id);
    if (index === -1) {
      return NextResponse.json({ error: "生徒情報が見つかりません。" }, { status: 404 });
    }

    const student = students[index];
    if (!student.password || !verifyPassword(currentPassword, student.password)) {
      return NextResponse.json({ error: "現在のパスワードが正しくありません。" }, { status: 401 });
    }

    if (verifyPassword(newPassword, student.password)) {
      return NextResponse.json({ error: "現在と同じパスワードは使えません。" }, { status: 400 });
    }

    const updatedStudents = [...students];
    updatedStudents[index] = {
      ...student,
      password: hashPassword(newPassword),
    };

    await writeStudents(updatedStudents);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Password change error:", error);
    return NextResponse.json(
      { error: "パスワード変更に失敗しました。時間をおいてもう一度お試しください。" },
      { status: 500 },
    );
  }
}
