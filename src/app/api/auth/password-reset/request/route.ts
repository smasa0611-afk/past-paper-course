import { NextResponse } from "next/server";
import { createPasswordResetToken } from "@/lib/password-reset-store";
import { sendPasswordResetEmail } from "@/lib/reset-email";
import { readStudents } from "@/lib/student-store";

type PasswordResetRequestBody = {
  id?: string;
};

function successResponse() {
  return NextResponse.json({
    success: true,
    message: "登録済みメールアドレスがある場合、パスワード再設定メールを送信しました。",
  });
}

export async function POST(req: Request) {
  try {
    const { id } = (await req.json()) as PasswordResetRequestBody;
    const studentId = id?.trim();
    if (!studentId) {
      return NextResponse.json({ error: "生徒IDを入力してください。" }, { status: 400 });
    }

    const students = await readStudents();
    const student = students.find((item) => item.id === studentId);
    const email = student?.email?.trim().toLowerCase();
    if (!student || !email) return successResponse();

    const { token } = createPasswordResetToken(student.id);
    const resetUrl = new URL(`/reset-password?token=${encodeURIComponent(token)}`, req.url).toString();
    const result = await sendPasswordResetEmail({
      to: email,
      studentId: student.id,
      resetUrl,
      createdAt: new Date().toISOString(),
    });

    const response = successResponse();
    if (result.mode === "dev-outbox") {
      response.headers.set("x-dev-mail-outbox", "data/dev-mail-outbox.json");
      response.headers.set("x-password-reset-delivery", "dev-outbox");
    }
    return response;
  } catch (error) {
    console.error("Password reset request error:", error);
    if (process.env.NODE_ENV !== "production") {
      return successResponse();
    }
    return NextResponse.json(
      { error: "パスワード再設定メールの送信に失敗しました。時間をおいてもう一度お試しください。" },
      { status: 500 },
    );
  }
}
