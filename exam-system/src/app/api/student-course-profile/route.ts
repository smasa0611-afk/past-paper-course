import { NextResponse } from "next/server";
import path from "path";
import { readStudentCourseEnrollments } from "@/lib/course-management-store";
import { readJsonFile } from "@/lib/json-file-store";
import { readMasterStudentCourseEnrollmentsForProfileAsync } from "@/lib/master-data";
import { getSecondaryTargetFromCourse, secondaryTargetLabels } from "@/lib/secondary-access";
import { getSessionUser } from "@/lib/session";
import type { StudentGoal } from "@/types/admissions";

const goalsPath = path.resolve(process.cwd(), "..", "data", "student_goals.json");

function hasGoal(enrollment: { goalUniversity?: string; goalFaculty?: string; goalDepartment?: string }) {
  return Boolean(enrollment.goalUniversity || enrollment.goalFaculty || enrollment.goalDepartment);
}

function normalizeCourseLabel(value?: string) {
  return value?.replace(/二次/g, "2次") ?? value;
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });

  const masterEnrollments = await readMasterStudentCourseEnrollmentsForProfileAsync(user.id);
  const enrollments = masterEnrollments && masterEnrollments.length > 0
    ? masterEnrollments
    : readStudentCourseEnrollments().filter((enrollment) => enrollment.studentId === user.id);
  const studentGoals = readJsonFile<StudentGoal[]>(goalsPath, []).filter((goal) => goal.studentId === user.id);
  const currentGoal = studentGoals[0] ?? null;
  const goalEnrollment = enrollments.find(hasGoal) ?? enrollments[0] ?? null;
  const secondaryCourses = enrollments
    .map((enrollment) => {
      const targetKey = getSecondaryTargetFromCourse(enrollment);
      if (!targetKey) return null;
      return {
        ...enrollment,
        courseName: normalizeCourseLabel(enrollment.courseName),
        courseCategory: normalizeCourseLabel(enrollment.courseCategory),
        targetKey,
        targetName: secondaryTargetLabels[targetKey],
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return NextResponse.json({
    studentId: user.id,
    goal: goalEnrollment
      ? {
          university: currentGoal?.university ?? goalEnrollment.goalUniversity ?? "",
          faculty: currentGoal?.faculty ?? goalEnrollment.goalFaculty ?? "",
          department: currentGoal?.department ?? goalEnrollment.goalDepartment ?? "",
          method: currentGoal?.method ?? "",
          schedule: currentGoal?.schedule ?? "",
          targetRate: currentGoal?.bRate ?? null,
          goalId: currentGoal?.id ?? null,
          admissionCode: currentGoal?.admissionCode ?? null,
        }
      : null,
    enrollments: enrollments.map((enrollment) => ({
      ...enrollment,
      courseName: normalizeCourseLabel(enrollment.courseName),
      courseCategory: normalizeCourseLabel(enrollment.courseCategory),
    })),
    hasSecondaryCourse: secondaryCourses.length > 0,
    secondaryCourses,
  });
}
