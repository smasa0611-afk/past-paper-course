import { NextResponse } from "next/server";
import path from "path";
import { readJsonFile, writeJsonFileAtomic } from "@/lib/json-file-store";
import { getSessionUser } from "@/lib/session";
import type { PublicVideoQuiz, VideoQuiz, VideoQuizSubmission } from "@/types/video-quiz";

type QuizPostBody =
  | {
      action?: "submit";
      quizId?: string;
      answers?: Record<string, string>;
    }
  | {
      action: "view-explanation";
      submissionId?: string;
    };

function quizzesPath() {
  return path.resolve(process.cwd(), "..", "data", "video-quizzes.json");
}

function submissionsPath() {
  return path.resolve(process.cwd(), "..", "data", "video-quiz-submissions.json");
}

function readQuizzes() {
  return readJsonFile<VideoQuiz[]>(quizzesPath(), []);
}

function readSubmissions() {
  return readJsonFile<VideoQuizSubmission[]>(submissionsPath(), []);
}

function writeSubmissions(records: VideoQuizSubmission[]) {
  writeJsonFileAtomic(submissionsPath(), records);
}

function latestSubmission(records: VideoQuizSubmission[], userId: string, quizId: string) {
  return records
    .filter((record) => record.userId === userId && record.quizId === quizId)
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0];
}

function toPublicQuiz(quiz: VideoQuiz): PublicVideoQuiz {
  return {
    ...quiz,
    questions: quiz.questions.map(({ correctChoiceId: _correctChoiceId, ...question }) => question),
  };
}

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const lessonId = searchParams.get("lessonId");
  const quizId = searchParams.get("quizId");
  const quiz = readQuizzes().find((item) => (quizId ? item.id === quizId : item.lessonId === lessonId));

  if (!quiz) {
    return NextResponse.json({ error: "Video quiz not found." }, { status: 404 });
  }

  const submission = latestSubmission(readSubmissions(), user.id, quiz.id) ?? null;
  return NextResponse.json(
    {
      quiz: toPublicQuiz(quiz),
      submission,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const body = (await req.json()) as QuizPostBody;
  const records = readSubmissions();

  if (body.action === "view-explanation") {
    const submissionId = body.submissionId?.trim();
    const index = records.findIndex((record) => record.id === submissionId && record.userId === user.id);
    if (index < 0) {
      return NextResponse.json({ error: "Submission not found." }, { status: 404 });
    }

    records[index] = {
      ...records[index],
      explanationViewed: true,
      explanationViewedAt: new Date().toISOString(),
    };
    writeSubmissions(records);
    return NextResponse.json(records[index], { headers: { "Cache-Control": "no-store" } });
  }

  const quizId = body.quizId?.trim();
  const quiz = readQuizzes().find((item) => item.id === quizId);
  if (!quiz) {
    return NextResponse.json({ error: "Video quiz not found." }, { status: 404 });
  }

  const answers = body.answers ?? {};
  const correctAnswers = Object.fromEntries(quiz.questions.map((question) => [question.id, question.correctChoiceId]));
  const results = Object.fromEntries(quiz.questions.map((question) => [question.id, answers[question.id] === question.correctChoiceId]));
  const score = Object.values(results).filter(Boolean).length;
  const maxScore = quiz.questions.length;
  const passed = maxScore > 0 ? Math.round((score / maxScore) * 100) >= quiz.targetPoint : false;
  const now = new Date().toISOString();
  const submission: VideoQuizSubmission = {
    id: `${user.id}-${quiz.id}-${Date.now()}`,
    userId: user.id,
    lessonId: quiz.lessonId,
    quizId: quiz.id,
    answers,
    correctAnswers,
    results,
    score,
    maxScore,
    passed,
    submittedAt: now,
    explanationViewed: false,
  };

  records.push(submission);
  writeSubmissions(records);
  return NextResponse.json(submission, { headers: { "Cache-Control": "no-store" } });
}
