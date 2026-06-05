import { NextResponse } from "next/server";
import { parseCsv, missingColumns } from "@/lib/csv";
import { readImportedScores, writeImportedScores, type ImportedScore } from "@/lib/course-management-store";
import { getTeacherEmployeeId, isSystemAdmin, requireSystemAdmin } from "@/lib/admin";
import { readVisibleMasterStudentsAsync } from "@/lib/master-data";
import { readStudents } from "@/lib/student-store";

const requiredColumns = ["生徒ID", "講座名", "課題名", "教科", "年度", "回数", "点数", "提出日", "採点日", "備考"];
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value: string) {
  if (!value) return true;
  if (!datePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function POST(req: Request) {
  try {
    const session = await requireSystemAdmin();
    if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status });

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "CSVファイルを選択してください。" }, { status: 400 });

    const rows = parseCsv(await file.text());
    const missing = missingColumns(rows, requiredColumns);
    if (missing.length > 0) {
      return NextResponse.json({ error: "必須列が不足しています。", details: missing }, { status: 400 });
    }

    const baseStudents = await readStudents();
    const masterStudents = (await readVisibleMasterStudentsAsync(getTeacherEmployeeId(session.user.id), isSystemAdmin(session.user))) ?? [];
    const studentIds = new Set([...baseStudents.map((student) => student.id), ...masterStudents.map((student) => student.id)]);
    const errors: string[] = [];
    const importedAt = new Date().toISOString();
    const imported: ImportedScore[] = [];

    rows.forEach((row, index) => {
      const line = index + 2;
      const studentId = row["生徒ID"];
      const courseCode = row["講座コード"] || row["講座コース区分"] || "";
      const courseTitle = row["講座名"];
      const assignmentName = row["課題名"];
      const scoreRaw = row["点数"];
      let score: number | undefined;
      if (!studentId) errors.push(`${line}行目: 生徒IDが空欄です。`);
      if (studentId && !studentIds.has(studentId)) errors.push(`${line}行目: 生徒ID ${studentId} が既存生徒と紐づきません。`);
      if (`${courseTitle} ${assignmentName}`.includes("共通テスト")) {
        errors.push(`${line}行目: 共通テスト演習はCSV取り込み対象外です。生徒のマーク選択による自動採点結果を使用してください。`);
      }
      if (scoreRaw) {
        score = Number(scoreRaw);
        if (!Number.isFinite(score)) errors.push(`${line}行目: 点数が数値ではありません。`);
        if (Number.isFinite(score) && (score < 0 || score > 100)) errors.push(`${line}行目: 点数は0〜100の範囲で入力してください。`);
      }
      if (!validDate(row["提出日"])) errors.push(`${line}行目: 提出日の日付形式が不正です。`);
      if (!validDate(row["採点日"])) errors.push(`${line}行目: 採点日の日付形式が不正です。`);
      if (!studentId || !studentIds.has(studentId)) return;

      imported.push({
        studentId,
        courseCode,
        courseTitle,
        assignmentName,
        subject: row["教科"],
        year: row["年度"],
        round: row["回数"],
        score,
        submittedAt: row["提出日"] || "",
        gradedAt: row["採点日"] || "",
        note: row["備考"],
        importedAt,
      });
    });

    if (errors.length > 0) return NextResponse.json({ error: "CSVの検証に失敗しました。", details: errors }, { status: 400 });

    const existing = readImportedScores();
    const next = existing.filter(
      (current) => !imported.some((incoming) => incoming.studentId === current.studentId && incoming.courseTitle === current.courseTitle && incoming.assignmentName === current.assignmentName && incoming.round === current.round),
    );
    next.push(...imported);
    writeImportedScores(next);

    return NextResponse.json({ success: true, importedCount: imported.length, totalCount: next.length });
  } catch (error) {
    console.error("Error importing score CSV:", error);
    return NextResponse.json({ error: "添削講座・点数CSVの取り込みに失敗しました。" }, { status: 500 });
  }
}
