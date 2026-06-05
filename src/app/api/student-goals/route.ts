import { NextResponse } from "next/server";
import path from "path";
import type { StudentGoal, AdmissionRecord } from "@/types/admissions";
import { readJsonFile, writeJsonFileAtomic } from "@/lib/json-file-store";
import { requireSession } from "@/lib/session";

type GoalBody = { id?: string; studentId?: string; admission?: AdmissionRecord };

const dataPath = path.resolve(process.cwd(), "data", "student_goals.json");

function readGoals() {
  return readJsonFile<StudentGoal[]>(dataPath, []);
}

function writeGoals(goals: StudentGoal[]) {
  writeJsonFileAtomic(dataPath, goals);
}

function canAccessStudent(requestedStudentId: string | null, sessionUser: { id: string; role: "student" | "teacher" }) {
  if (sessionUser.role === "teacher") return true;
  return !requestedStudentId || requestedStudentId === sessionUser.id;
}

export async function GET(req: Request) {
  try {
    const session = await requireSession();
    if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status });

    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");
    if (!canAccessStudent(studentId, session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const goals = readGoals();
    const effectiveStudentId = session.user.role === "student" ? session.user.id : studentId;
    return NextResponse.json(
      effectiveStudentId ? goals.filter((goal) => goal.studentId === effectiveStudentId) : goals,
    );
  } catch (error) {
    console.error("Student goals read error:", error);
    return NextResponse.json({ error: "志望校データの読み込みに失敗しました。" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status });

    const { studentId, admission } = (await req.json()) as GoalBody;
    const effectiveStudentId = session.user.role === "teacher" ? studentId : session.user.id;
    if (!effectiveStudentId || !admission?.code) {
      return NextResponse.json({ error: "studentId と admission は必須です。" }, { status: 400 });
    }

    const goals = readGoals();
    const duplicate = goals.find(
      (goal) => goal.studentId === effectiveStudentId && goal.admissionCode === admission.code,
    );
    if (duplicate) return NextResponse.json(duplicate);

    const nextGoal: StudentGoal = {
      id: `${effectiveStudentId}-${admission.code}`,
      studentId: effectiveStudentId,
      admissionCode: admission.code,
      university: admission.university,
      faculty: admission.faculty,
      department: admission.department,
      method: admission.method,
      schedule: admission.schedule,
      bRate: admission.bRate,
      createdAt: new Date().toISOString(),
    };
    goals.push(nextGoal);
    writeGoals(goals);
    return NextResponse.json(nextGoal);
  } catch (error) {
    console.error("Student goals save error:", error);
    return NextResponse.json({ error: "志望校の保存に失敗しました。" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireSession();
    if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status });

    const { id } = (await req.json()) as GoalBody;
    if (!id) return NextResponse.json({ error: "id は必須です。" }, { status: 400 });

    const goals = readGoals();
    const target = goals.find((goal) => goal.id === id);
    if (!target) return NextResponse.json({ error: "削除対象の志望校が見つかりません。" }, { status: 404 });
    if (session.user.role !== "teacher" && target.studentId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    writeGoals(goals.filter((goal) => goal.id !== id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Student goals delete error:", error);
    return NextResponse.json({ error: "志望校の削除に失敗しました。" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await requireSession();
    if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status });

    const { id, studentId, admission } = (await req.json()) as GoalBody;
    const effectiveStudentId = session.user.role === "teacher" ? studentId : session.user.id;
    if (!id || !effectiveStudentId || !admission?.code) {
      return NextResponse.json({ error: "id、studentId、admission は必須です。" }, { status: 400 });
    }

    const goals = readGoals();
    const index = goals.findIndex((goal) => goal.id === id && goal.studentId === effectiveStudentId);
    if (index < 0) {
      return NextResponse.json({ error: "更新対象の志望校が見つかりません。" }, { status: 404 });
    }

    goals[index] = {
      ...goals[index],
      admissionCode: admission.code,
      university: admission.university,
      faculty: admission.faculty,
      department: admission.department,
      method: admission.method,
      schedule: admission.schedule,
      bRate: admission.bRate,
    };
    writeGoals(goals);
    return NextResponse.json(goals[index]);
  } catch (error) {
    console.error("Student goals update error:", error);
    return NextResponse.json({ error: "志望校の更新に失敗しました。" }, { status: 500 });
  }
}
