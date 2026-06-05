import { NextResponse } from "next/server";
import { getPasswordValidationError } from "@/lib/auth-validation";
import { consumePasswordResetToken } from "@/lib/password-reset-store";
import { hashPassword } from "@/lib/passwords";
import { readStudents, writeStudents } from "@/lib/student-store";

type PasswordResetConfirmBody = {
  token?: string;
  password?: string;
};

export async function POST(req: Request) {
  try {
    const { token = "", password = "" } = (await req.json()) as PasswordResetConfirmBody;
    if (!token) return NextResponse.json({ error: "再設定リンクが無効です。" }, { status: 400 });

    const consumed = consumePasswordResetToken(token);
    if (!consumed.ok) {
      return NextResponse.json(
        { error: "再設定リンクが無効、または期限切れです。もう一度メールを送信してください。" },
        { status: 400 },
      );
    }

    const passwordError = getPasswordValidationError(password, consumed.record.studentId);
    if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });

    const students = await readStudents();
    const index = students.findIndex((student) => student.id === consumed.record.studentId);
    if (index === -1) {
      return NextResponse.json({ error: "生徒情報が見つかりません。" }, { status: 404 });
    }

    const updatedStudents = [...students];
    updatedStudents[index] = {
      ...updatedStudents[index],
      password: hashPassword(password),
    };
    await writeStudents(updatedStudents);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Password reset confirm error:", error);
    return NextResponse.json(
      { error: "パスワード再設定に失敗しました。時間をおいてもう一度お試しください。" },
      { status: 500 },
    );
  }
}
