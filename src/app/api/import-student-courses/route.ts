import { NextResponse } from "next/server";
import { parseCsv, missingColumns } from "@/lib/csv";
import { readCourseMaster, readStudentCourseEnrollments, writeStudentCourseEnrollments, type StudentCourseEnrollment } from "@/lib/course-management-store";
import { requireSession } from "@/lib/session";
import { readStudents, writeStudents } from "@/lib/student-store";

const requiredColumns = [
  "生徒ID",
  "所属グループ",
  "所属校舎",
  "学年",
  "志望大学",
  "志望学部",
  "志望学科",
  "受講コースコード",
  "受講コース名",
  "コース区分",
  "受講年度",
  "備考",
];

export async function POST(req: Request) {
  try {
    const session = await requireSession("teacher");
    if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status });

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "CSVファイルを選択してください。" }, { status: 400 });

    const rows = parseCsv(await file.text());
    const missing = missingColumns(rows, requiredColumns);
    if (missing.length > 0) {
      return NextResponse.json({ error: "必須列が不足しています。", details: missing }, { status: 400 });
    }

    const courseMap = new Map(readCourseMaster().map((course) => [course.code, course]));
    const errors: string[] = [];
    const imported: StudentCourseEnrollment[] = [];

    rows.forEach((row, index) => {
      const line = index + 2;
      const studentId = row["生徒ID"];
      const code = row["受講コースコード"];
      if (!studentId) errors.push(`${line}行目: 生徒IDが空欄です。`);
      if (!/^\d{3}$/.test(code)) errors.push(`${line}行目: 受講コースコードは3桁で入力してください。`);
      const masterCourse = courseMap.get(code);
      if (code && !masterCourse) errors.push(`${line}行目: 受講コースコード ${code} はコースマスタに存在しません。`);
      if (!studentId || !masterCourse) return;

      imported.push({
        studentId,
        group: row["所属グループ"],
        campus: row["所属校舎"],
        grade: row["学年"],
        goalUniversity: row["志望大学"],
        goalFaculty: row["志望学部"],
        goalDepartment: row["志望学科"],
        courseCode: masterCourse.code,
        courseName: masterCourse.name,
        courseCategory: masterCourse.category,
        year: row["受講年度"],
        note: row["備考"],
      });
    });

    if (errors.length > 0) return NextResponse.json({ error: "CSVの検証に失敗しました。", details: errors }, { status: 400 });

    const existingEnrollments = readStudentCourseEnrollments();
    const nextEnrollments = existingEnrollments.filter(
      (current) => !imported.some((incoming) => incoming.studentId === current.studentId && incoming.courseCode === current.courseCode),
    );
    nextEnrollments.push(...imported);
    writeStudentCourseEnrollments(nextEnrollments);

    const students = await readStudents();
    const studentMap = new Map(students.map((student) => [student.id, student]));
    imported.forEach((enrollment) => {
      const existing = studentMap.get(enrollment.studentId);
      const target = [enrollment.goalUniversity, enrollment.goalFaculty, enrollment.goalDepartment].filter(Boolean).join(" ");
      if (existing) {
        existing.campus = enrollment.campus || existing.campus || "";
        existing.grade = enrollment.grade || existing.grade || "";
        existing.target = target || existing.target || "";
        return;
      }
      students.push({
        id: enrollment.studentId,
        campus: enrollment.campus || "",
        grade: enrollment.grade || "",
        target,
      });
    });
    await writeStudents(students);

    return NextResponse.json({ success: true, importedCount: imported.length, totalCount: nextEnrollments.length });
  } catch (error) {
    console.error("Error importing student course CSV:", error);
    return NextResponse.json({ error: "生徒マスタ・受講コースCSVの取り込みに失敗しました。" }, { status: 500 });
  }
}
