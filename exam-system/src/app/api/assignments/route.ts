import { NextResponse } from "next/server";
import { readAssignments, writeAssignments, type Assignment } from "@/lib/assignment-store";
import { requireSession } from "@/lib/session";

type DuplicateMode = "skip" | "overwrite" | "update_due_only";
type AssignmentBody = {
  studentId?: string;
  studentIds?: string[];
  examId?: string;
  dueDate?: string;
  mode?: DuplicateMode;
  id?: string;
};

function createAssignmentId(studentId: string, examId: string) {
  return `assignment-${studentId}-${examId.replaceAll("/", "-")}`;
}

function visibleAssignments(assignments: Assignment[], user: { id: string; role: string }) {
  return user.role === "teacher"
    ? assignments
    : assignments.filter((assignment) => assignment.studentId === user.id);
}

export async function GET() {
  try {
    const session = await requireSession();
    if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status });

    const assignments = await readAssignments();
    return NextResponse.json(visibleAssignments(assignments, session.user));
  } catch (error) {
    console.error("Error reading assignments:", error);
    return NextResponse.json({ error: "課題データの読み込みに失敗しました。" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireSession("teacher");
    if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status });

    const { studentId, studentIds, examId, dueDate, mode = "update_due_only" } = (await req.json()) as AssignmentBody;
    const targets = Array.from(new Set([...(studentIds ?? []), ...(studentId ? [studentId] : [])])).filter(Boolean);
    if (!targets.length || !examId || !dueDate) {
      return NextResponse.json({ error: "studentId または studentIds、examId、dueDate は必須です。" }, { status: 400 });
    }

    const assignments = await readAssignments();
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    targets.forEach((targetStudentId) => {
      const existing = assignments.find(
        (assignment) => assignment.studentId === targetStudentId && assignment.examId === examId,
      );
      if (!existing) {
        assignments.push({ id: createAssignmentId(targetStudentId, examId), studentId: targetStudentId, examId, dueDate });
        createdCount += 1;
        return;
      }
      if (mode === "skip") {
        skippedCount += 1;
        return;
      }
      existing.dueDate = dueDate;
      updatedCount += 1;
    });

    await writeAssignments(assignments);
    return NextResponse.json({
      success: true,
      createdCount,
      updatedCount,
      skippedCount,
      assignments: visibleAssignments(assignments, session.user),
    });
  } catch (error) {
    console.error("Error saving assignment:", error);
    return NextResponse.json({ error: "課題登録に失敗しました。" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await requireSession("teacher");
    if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status });

    const { id, dueDate } = (await req.json()) as AssignmentBody;
    if (!id || !dueDate) return NextResponse.json({ error: "id と dueDate は必須です。" }, { status: 400 });

    const assignments = await readAssignments();
    const target = assignments.find((assignment) => assignment.id === id);
    if (!target) return NextResponse.json({ error: "更新対象の課題が見つかりません。" }, { status: 404 });

    target.dueDate = dueDate;
    await writeAssignments(assignments);
    return NextResponse.json({ success: true, assignment: target, assignments: visibleAssignments(assignments, session.user) });
  } catch (error) {
    console.error("Error updating assignment:", error);
    return NextResponse.json({ error: "課題の更新に失敗しました。" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireSession("teacher");
    if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status });

    const { id } = (await req.json()) as AssignmentBody;
    if (!id) return NextResponse.json({ error: "id は必須です。" }, { status: 400 });

    const assignments = await readAssignments();
    const next = assignments.filter((assignment) => assignment.id !== id);
    if (next.length === assignments.length) {
      return NextResponse.json({ error: "削除対象の課題が見つかりません。" }, { status: 404 });
    }

    await writeAssignments(next);
    return NextResponse.json({ success: true, assignments: visibleAssignments(next, session.user) });
  } catch (error) {
    console.error("Error deleting assignment:", error);
    return NextResponse.json({ error: "課題の削除に失敗しました。" }, { status: 500 });
  }
}
