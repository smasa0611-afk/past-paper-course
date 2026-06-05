import { NextResponse } from "next/server";
import { getTeacherEmployeeId, isSystemAdmin } from "@/lib/admin";
import { readVisibleMasterStudentsAsync } from "@/lib/master-data";
import { publicStudentName } from "@/lib/nicknames";
import { requireSession } from "@/lib/session";
import { readStudents, writeStudents, type StudentRecord } from "@/lib/student-store";

type StudentBody = Partial<StudentRecord>;

export async function GET() {
  try {
    const session = await requireSession();
    if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status });

    const localStudents = (await readStudents()).map((student) => ({
        id: student.id,
        name: student.name ?? "",
        nickname: student.nickname ?? "",
        displayName: publicStudentName(student),
        email: student.email ?? "",
        target: student.target ?? "",
        group: "デモ",
        campus: student.campus ?? "",
        grade: student.grade ?? "",
        setupComplete: Boolean(student.password && student.nickname),
      }));
    const masterStudents = await readVisibleMasterStudentsAsync(getTeacherEmployeeId(session.user.id), isSystemAdmin(session.user));
    if (masterStudents) {
      const merged = new Map(masterStudents.map((student) => [student.id, student]));
      localStudents.forEach((student) => {
        if (!merged.has(student.id)) merged.set(student.id, student);
      });
      return NextResponse.json([...merged.values()]);
    }

    return NextResponse.json(localStudents);
  } catch (error) {
    console.error("Error reading students:", error);
    return NextResponse.json({ error: "生徒データの読み込みに失敗しました。" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession("teacher");
    if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status });

    const { id, name = "", nickname = "", password = "", target = "", campus = "", grade = "" } = (await req.json()) as StudentBody;
    if (!id) {
      return NextResponse.json({ error: "生徒IDは必須です。" }, { status: 400 });
    }

    const students = await readStudents();
    if (students.some((student) => student.id === id)) {
      return NextResponse.json({ error: "この生徒IDはすでに登録されています。" }, { status: 409 });
    }

    students.push({ id, name, nickname, password, target, campus, grade });
    await writeStudents(students);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error adding student:", error);
    return NextResponse.json({ error: "生徒データの追加に失敗しました。" }, { status: 500 });
  }
}
