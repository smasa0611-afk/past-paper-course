import { NextResponse } from "next/server";
import { getTeacherEmployeeId, isSystemAdmin } from "@/lib/admin";
import { readCourseMaster, readImportedScores, readStudentCourseEnrollments } from "@/lib/course-management-store";
import { readMasterCourseManagementAsync } from "@/lib/master-data";
import { requireSession } from "@/lib/session";
import { isTeacher1092DemoUser, mergeByKey, teacher1092DemoCourses, teacher1092DemoEnrollments } from "@/lib/teacher-1092-demo";

type Course = {
  code: string;
  name: string;
  category: string;
};

type Enrollment = ReturnType<typeof readStudentCourseEnrollments>[number];

const demoCourseCodeMap: Record<string, string> = {
  "001": "01",
  "101": "10",
  "102": "20",
  "103": "30",
  "104": "40",
};

function applyLineupToDemoEnrollments(enrollments: Enrollment[], courses: Course[]) {
  if (courses.length === 0) return enrollments;
  const courseByCode = new Map(courses.map((course) => [course.code, course]));
  const secondaryCourses = courses.filter((course) => course.code !== "01");

  return enrollments.map((enrollment, index) => {
    const mappedCode = demoCourseCodeMap[enrollment.courseCode] ?? secondaryCourses[index % Math.max(secondaryCourses.length, 1)]?.code ?? courses[index % courses.length].code;
    const course = courseByCode.get(mappedCode) ?? courses[index % courses.length];
    return {
      ...enrollment,
      courseCode: course.code,
      courseName: course.name,
      courseCategory: course.code === "01" ? "共通テスト演習" : "大学別過去問添削",
      year: enrollment.year || "2026",
      note: enrollment.note || "講座ラインナップマスターを適用",
    };
  });
}

function withTeacher1092DemoData(data: { courses: Course[]; enrollments: Enrollment[]; scores: unknown[] }, userId: string) {
  if (!isTeacher1092DemoUser(userId)) return data;
  return {
    ...data,
    courses: mergeByKey(data.courses, teacher1092DemoCourses, (course) => course.code),
    enrollments: mergeByKey(data.enrollments, teacher1092DemoEnrollments, (enrollment) => `${enrollment.studentId}-${enrollment.courseCode}-${enrollment.year ?? ""}`),
  };
}

export async function GET() {
  try {
    const session = await requireSession("teacher");
    if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status });

    const masterData = await readMasterCourseManagementAsync(getTeacherEmployeeId(session.user.id), isSystemAdmin(session.user));
    if (masterData) {
      if (masterData.enrollments.length > 0 || masterData.hasMasterEnrollments) {
        return NextResponse.json(withTeacher1092DemoData(masterData, session.user.id));
      }
      return NextResponse.json({
        ...withTeacher1092DemoData({
          courses: masterData.courses,
          enrollments: applyLineupToDemoEnrollments(readStudentCourseEnrollments(), masterData.courses),
          scores: readImportedScores(),
        }, session.user.id),
      });
    }

    return NextResponse.json(withTeacher1092DemoData({
      courses: readCourseMaster(),
      enrollments: readStudentCourseEnrollments(),
      scores: readImportedScores(),
    }, session.user.id));
  } catch (error) {
    console.error("Error reading course management data:", error);
    return NextResponse.json({ error: "受講コース管理データの読み込みに失敗しました。" }, { status: 500 });
  }
}
