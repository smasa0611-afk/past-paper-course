import { NextResponse } from "next/server";
import { getSecondaryEnrollmentsFromCoursesAsync, readSecondaryEnrollments, secondaryTargetLabels } from "@/lib/secondary-access";
import { getSessionUser } from "@/lib/session";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });

  const enrollments = [...(await getSecondaryEnrollmentsFromCoursesAsync()), ...readSecondaryEnrollments()];
  const userEnrollments = user.role === "teacher" ? enrollments : enrollments.filter((item) => item.studentId === user.id);
  const subscribedTargetKeys = [...new Set(userEnrollments.filter((item) => item.subscribed).map((item) => item.targetKey))];

  return NextResponse.json({
    targets: secondaryTargetLabels,
    enrollments: userEnrollments,
    subscribedTargetKeys,
  });
}
