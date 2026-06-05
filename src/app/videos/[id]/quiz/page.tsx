"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, ClipboardCheck, Eye, LogIn, RotateCcw, XCircle } from "lucide-react";
import type { VideoLesson } from "@/types/video";
import type { PublicVideoQuiz, VideoQuizSubmission } from "@/types/video-quiz";

type User = { id: string; name: string; role: "student" | "teacher" };

type QuizResponse = {
  quiz: PublicVideoQuiz;
  submission: VideoQuizSubmission | null;
};

export default function VideoQuizPage() {
  const params = useParams<{ id: string }>();
  const lessonId = params.id;
  const [user, setUser] = useState<User | null>(null);
  const [lesson, setLesson] = useState<VideoLesson | null>(null);
  const [quiz, setQuiz] = useState<PublicVideoQuiz | null>(null);
  const [submission, setSubmission] = useState<VideoQuizSubmission | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showExplanation, setShowExplanation] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then((res) => (res.ok ? res.json() : { user: null })),
      fetch(`/api/video-lessons?id=${encodeURIComponent(lessonId)}`).then((res) => (res.ok ? res.json() : null)),
      fetch(`/api/video-quizzes?lessonId=${encodeURIComponent(lessonId)}`, { cache: "no-store" }).then((res) => (res.ok ? res.json() : null)),
    ])
      .then(([me, lessonData, quizData]) => {
        setUser(me.user);
        setLesson(lessonData);
        const payload = quizData as QuizResponse | null;
        setQuiz(payload?.quiz ?? null);
        setSubmission(payload?.submission ?? null);
        setShowExplanation(Boolean(payload?.submission?.explanationViewed));
      })
      .catch(() => {
        setUser(null);
        setLesson(null);
        setQuiz(null);
        setSubmission(null);
      })
      .finally(() => setLoading(false));
  }, [lessonId]);

  const answeredCount = useMemo(() => {
    if (!quiz) return 0;
    return quiz.questions.filter((question) => answers[question.id]).length;
  }, [answers, quiz]);

  const canSubmit = Boolean(quiz && answeredCount === quiz.questions.length && !submitting);

  const submitQuiz = async () => {
    if (!quiz || !canSubmit) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/video-quizzes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit", quizId: quiz.id, answers }),
      });
      if (res.ok) {
        const saved = (await res.json()) as VideoQuizSubmission;
        setSubmission(saved);
        setShowExplanation(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const viewExplanation = async () => {
    if (!submission) return;
    setShowExplanation(true);
    if (submission.explanationViewed) return;
    const res = await fetch("/api/video-quizzes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "view-explanation", submissionId: submission.id }),
    });
    if (res.ok) {
      setSubmission((await res.json()) as VideoQuizSubmission);
    }
  };

  const retry = () => {
    setSubmission(null);
    setAnswers({});
    setShowExplanation(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-blue-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-6">
        <div className="glass-card w-full max-w-md rounded-[28px] p-8 text-center shadow-[0_24px_80px_rgba(5,12,28,0.26)]">
          <LogIn className="mx-auto mb-4 h-10 w-10 text-blue-400" />
          <h1 className="mb-3 text-2xl font-black text-slate-950">ログインが必要です</h1>
          <Link href="/login" className="glass-button-primary inline-flex px-5 py-3 text-sm font-bold">
            ログインへ
          </Link>
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Link href={`/videos/${lessonId}`} className="glass-pill inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-[#dbe7ff]">
          <ArrowLeft className="h-4 w-4" />
          映像へ戻る
        </Link>
        <div className="glass-card mt-6 rounded-[28px] p-8 text-center">
          <p className="text-xl font-black text-slate-950">確認問題が見つかりません</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-slate-950">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6 md:py-10">
        <div className="mb-6">
          <Link href={`/videos/${lessonId}`} className="glass-pill inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-[#dbe7ff] hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            映像へ戻る
          </Link>
        </div>

        <section className="glass-card mb-6 rounded-[30px] p-5 content-on-light">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                <ClipboardCheck className="h-4 w-4" />
                確認問題
              </div>
              <h1 className="text-2xl font-black text-slate-950 md:text-4xl">{quiz.title}</h1>
              <p className="mt-3 text-sm font-bold text-slate-600">{lesson ? `${lesson.courseName} / ${lesson.teacher}` : "映像授業"}</p>
            </div>
            {submission && (
              <div className={`rounded-2xl px-5 py-4 text-center font-black ${submission.passed ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                <p className="text-sm">結果</p>
                <p className="mt-1 text-3xl">{submission.score}/{submission.maxScore}</p>
              </div>
            )}
          </div>
        </section>

        {submission ? (
          <section className="mb-5 rounded-2xl border border-white/40 bg-white/75 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xl font-black text-slate-950">{submission.passed ? "合格ライン到達" : "もう一度確認しましょう"}</p>
                <p className="mt-1 text-sm font-bold text-slate-600">正誤判定を表示しています。解答解説は必要な生徒だけ開けます。</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void viewExplanation()} className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-black text-white hover:bg-blue-500">
                  <Eye className="h-4 w-4" />
                  解答解説を見る
                </button>
                <button type="button" onClick={retry} className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50">
                  <RotateCcw className="h-4 w-4" />
                  再挑戦
                </button>
              </div>
            </div>
          </section>
        ) : null}

        <section className="grid gap-4">
          {quiz.questions.map((question) => {
            const selected = submission ? submission.answers[question.id] : answers[question.id];
            const result = submission?.results[question.id];
            const correct = submission?.correctAnswers[question.id];
            return (
              <article key={question.id} className="rounded-2xl border border-white/40 bg-white/80 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.12)]">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-black text-emerald-700">問{question.number}</p>
                    <p className="mt-2 text-base font-bold leading-7 text-slate-700">{question.prompt}</p>
                  </div>
                  {submission && (
                    <span className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-sm font-black ${result ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                      {result ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      {result ? "〇 正解" : "× 不正解"}
                    </span>
                  )}
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-4">
                  {question.choices.map((choice) => {
                    const active = selected === choice.id;
                    const isCorrect = submission && correct === choice.id;
                    const isWrong = submission && active && correct !== choice.id;
                    return (
                      <label
                        key={choice.id}
                        className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl border px-4 py-3 text-center text-lg font-black transition ${
                          isCorrect
                            ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                            : isWrong
                              ? "border-rose-500 bg-rose-50 text-rose-800"
                              : active
                                ? "border-blue-500 bg-blue-50 text-blue-800"
                                : "border-slate-200 bg-white text-slate-700 hover:border-blue-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name={question.id}
                          value={choice.id}
                          checked={active}
                          disabled={Boolean(submission)}
                          onChange={() => setAnswers((current) => ({ ...current, [question.id]: choice.id }))}
                          className="sr-only"
                        />
                        {choice.label}
                      </label>
                    );
                  })}
                </div>

                {showExplanation && question.explanationImageUrl ? (
                  <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                    <img src={question.explanationImageUrl} alt={`問${question.number}の解答解説`} className="w-full" />
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>

        {!submission && (
          <div className="sticky bottom-4 mt-6 flex flex-col gap-3 rounded-2xl border border-white/45 bg-white/90 p-4 shadow-[0_18px_55px_rgba(15,23,42,0.2)] backdrop-blur md:flex-row md:items-center md:justify-between">
            <p className="text-sm font-black text-slate-700">
              {answeredCount}/{quiz.questions.length} 問 解答済み
            </p>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => void submitQuiz()}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-6 py-3 text-sm font-black text-white shadow-[0_12px_30px_rgba(5,150,105,0.24)] transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              <ClipboardCheck className="h-5 w-5" />
              提出して判定
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
