import { NextResponse } from "next/server";
import type { GradeData, SectionGrade } from "@/types/grading";
import {
  readSubmissionText,
  submissionExists,
  writeSubmissionText,
} from "@/lib/submission-storage";
import { requireSession } from "@/lib/session";

type GradeRequest = {
  examId?: string;
  submissionId?: string;
  score?: number;
  maxScore?: number;
  feedback?: string;
  sections?: Partial<SectionGrade>[];
};

function normalizeSection(section: Partial<SectionGrade>, index: number): SectionGrade {
  return {
    id: String(section.id || `section-${index + 1}`),
    title: String(section.title || `螟ｧ蝠・{index + 1}`),
    score: Math.max(0, Number(section.score ?? 0) || 0),
    maxScore: Math.max(0, Number(section.maxScore ?? 0) || 0),
    feedback: String(section.feedback || ""),
    retryRecommended: Boolean(section.retryRecommended),
  };
}

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    if (!session.ok) return NextResponse.json({ error: session.error }, { status: session.status });

    const data = (await req.json()) as GradeRequest;
    const { examId, submissionId, feedback } = data;

    if (!examId || !submissionId) {
      return NextResponse.json({ error: "examId と submissionId は必須です。" }, { status: 400 });
    }

    if (!(await submissionExists(examId, submissionId))) {
      return NextResponse.json({ error: "提出データが見つかりません。" }, { status: 404 });
    }

    const submissionText = await readSubmissionText(`submissions/${examId}/${submissionId}/submission.json`);
    if (!submissionText) {
      return NextResponse.json({ error: "提出データが見つかりません。" }, { status: 404 });
    }

    const submission = JSON.parse(submissionText) as Record<string, unknown>;
    if (session.user.role !== "teacher" && submission.studentId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const sections = Array.isArray(data.sections)
      ? data.sections.map(normalizeSection).filter((section) => section.title.trim().length > 0)
      : [];

    const sectionTotal = sections.reduce((sum, section) => sum + section.score, 0);
    const sectionMax = sections.reduce((sum, section) => sum + section.maxScore, 0);
    const totalScore = sections.length > 0 ? sectionTotal : Math.max(0, Number(data.score ?? 0) || 0);
    const totalMax = sections.length > 0 ? sectionMax : Math.max(0, Number(data.maxScore ?? 0) || 0);

    const gradeData: GradeData = {
      examId,
      submissionId,
      score: totalScore,
      maxScore: totalMax,
      feedback: String(feedback || ""),
      gradedAt: new Date().toISOString(),
      sections,
    };

    await writeSubmissionText(
      examId,
      submissionId,
      "grade.json",
      JSON.stringify(gradeData, null, 2),
      "application/json",
    );

    submission.status = "graded";
    submission.score = totalScore;
    submission.maxScore = totalMax;
    submission.feedback = String(feedback || "");
    submission.gradedAt = gradeData.gradedAt;

    await writeSubmissionText(
      examId,
      submissionId,
      "submission.json",
      JSON.stringify(submission, null, 2),
      "application/json",
    );

    return NextResponse.json({ success: true, grade: gradeData });
  } catch (error) {
    console.error("Grading save error:", error);
    return NextResponse.json(
      { error: "採点結果の保存に失敗しました。" },
      { status: 500 },
    );
  }
}
