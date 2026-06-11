import { NextResponse } from "next/server";
import { listStoredSubmissions } from "@/lib/submission-storage";
import { requireSession } from "@/lib/session";
import { isTeacher1092DemoUser, mergeByKey, teacher1092DemoSubmissions } from "@/lib/teacher-1092-demo";

type Submission = Awaited<ReturnType<typeof listStoredSubmissions>>[number];

function sanitizeSubmission(submission: Submission) {
  return {
    ...submission,
    content: "",
    images: [],
    feedback: undefined,
  };
}

export async function GET(req: Request) {
  try {
    const session = await requireSession();
    if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status });

    const { searchParams } = new URL(req.url);
    const mine = searchParams.get("mine") === "1";
    const includeContent = searchParams.get("includeContent") === "1";
    const scope = searchParams.get("scope");
    const id = searchParams.get("id");

    let submissions = await listStoredSubmissions();
    if (isTeacher1092DemoUser(session.user.id)) {
      submissions = mergeByKey(submissions, teacher1092DemoSubmissions, (submission) => submission.id);
    }

    if (id) {
      submissions = submissions.filter((submission) => submission.id === id);
    }

    if (session.user.role === "student") {
      if (scope === "ranking") {
        return NextResponse.json(submissions.map(sanitizeSubmission));
      }

      submissions = submissions.filter((submission) => submission.studentId === session.user.id);
      return NextResponse.json(includeContent ? submissions : submissions.map(sanitizeSubmission));
    }

    if (mine) {
      submissions = submissions.filter((submission) => submission.studentId === session.user.id);
    }

    return NextResponse.json(includeContent ? submissions : submissions.map(sanitizeSubmission));
  } catch (error) {
    console.error("Error fetching submissions:", error);
    return NextResponse.json({ error: "Failed to fetch submissions" }, { status: 500 });
  }
}
