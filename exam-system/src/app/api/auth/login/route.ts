import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/passwords";
import { buildSessionCookieOptions, createSessionToken } from "@/lib/session";
import { readStudents } from "@/lib/student-store";
import { readTeachers, teachersFileExists } from "@/lib/teacher-store";

type UserRecord = {
  id: string;
  name: string;
  nickname?: string;
  password?: string;
  initialPassword?: string;
  employeeId?: string;
};

type LoginBody = {
  id?: string;
  password?: string;
  role?: "student" | "teacher";
};

const adminDemoTeacherId = "90000002";
const adminDemoTeacherPassword = "Admin2026";
const invalidCredentialsError = "IDまたはパスワードが正しくありません。";
const invalidInitialPasswordError = "IDまたは初期パスワードが正しくありません。";

export async function POST(req: Request) {
  try {
    const { id, password, role } = (await req.json()) as LoginBody;
    const loginId = id?.trim() ?? "";

    if (!loginId || !role || !password) {
      return NextResponse.json({ error: "ID、パスワード、利用区分を入力してください。" }, { status: 400 });
    }

    if ((role === "student" || role === "teacher") && !/^\d{8}$/.test(loginId)) {
      return NextResponse.json({ error: "IDは8桁の数字で入力してください。" }, { status: 400 });
    }

    if (role === "teacher" && !teachersFileExists()) {
      return NextResponse.json({ error: "ユーザーデータが見つかりません。" }, { status: 500 });
    }

    const users =
      role === "teacher"
        ? ((await readTeachers()) as UserRecord[])
        : ((await readStudents()) as UserRecord[]);
    const user = users.find((item) => item.id === loginId);

    if (!user) {
      return NextResponse.json({ error: invalidCredentialsError }, { status: 401 });
    }

    const isAdminDemoTeacherLogin =
      role === "teacher" && user.id === adminDemoTeacherId && password === adminDemoTeacherPassword;

    if (role === "student") {
      if (!user.password || !user.nickname) {
        if (!verifyPassword(password, user.initialPassword)) {
          return NextResponse.json({ error: invalidInitialPasswordError }, { status: 401 });
        }

        return NextResponse.json(
          { setupRequired: true, initialVerified: true, user: { id: user.id, role } },
          { status: 409 },
        );
      }

      if (!verifyPassword(password, user.password)) {
        return NextResponse.json({ error: invalidCredentialsError }, { status: 401 });
      }
    } else {
      if (!user.password && !isAdminDemoTeacherLogin) {
        if (!verifyPassword(password, user.initialPassword)) {
          return NextResponse.json({ error: invalidInitialPasswordError }, { status: 401 });
        }

        return NextResponse.json(
          { setupRequired: true, initialVerified: true, user: { id: user.id, role } },
          { status: 409 },
        );
      }

      if (!isAdminDemoTeacherLogin && !verifyPassword(password, user.password)) {
        return NextResponse.json({ error: invalidCredentialsError }, { status: 401 });
      }
    }

    const displayName = role === "student" ? user.nickname || user.id : user.name;
    const encodedToken = createSessionToken({ id: user.id, name: displayName, role });

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, name: displayName, role },
    });

    response.cookies.set("session", encodedToken, buildSessionCookieOptions());

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "ログインに失敗しました。" }, { status: 500 });
  }
}
