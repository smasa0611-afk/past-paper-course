"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  FileText,
  Loader2,
  MessageSquare,
  RotateCcw,
  XCircle,
  X,
  ZoomIn,
} from "lucide-react";
import type { GradeData } from "@/types/grading";
import type { MarksheetSchema } from "@/types/exam";
import { getDemoSubmission } from "@/lib/demo-submissions";
import {
  buildEffectiveScoringRules,
  getDisplayCorrectAnswers,
  matchesScoringRule,
  parseMarksheetSubmission,
} from "@/lib/marksheet-scoring";

type SubmissionData = {
  id: string;
  examId: string;
  studentId: string;
  content: string;
  images?: string[];
  timestamp: string;
  status: string;
};


type MarksheetAnswerReview = {
  id: string;
  displayLabel: string;
  prompt?: string;
  selectedAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
};

export default function ReviewPage(props: {
  params: Promise<{ id: string[] }>;
}) {
  const params = use(props.params);
  const parts = params.id;
  const submissionId = parts[parts.length - 1];
  const routeExamId = parts.length > 1 ? parts.slice(0, -1).join("/") : "";

  const [submission, setSubmission] = useState<SubmissionData | null>(null);
  const [grade, setGrade] = useState<GradeData | null>(null);
  const [marksheet, setMarksheet] = useState<MarksheetSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [resolvedExamId, setResolvedExamId] = useState(routeExamId);

  useEffect(() => {
    let cancelled = false;

    const loadReview = async () => {
      setLoading(true);

      try {
        let examId = routeExamId;
        let submissionData: SubmissionData | null = null;

        if (!examId) {
          const submissionsResponse = await fetch(`/api/submissions?id=${encodeURIComponent(submissionId)}&includeContent=1`);
          const submissions = submissionsResponse.ok
            ? ((await submissionsResponse.json()) as SubmissionData[])
            : [];
          submissionData = submissions.find((item) => item.id === submissionId) ?? getDemoSubmission(submissionId);
          examId = submissionData?.examId ?? "";
        }

        if (!examId) {
          if (!cancelled) {
            setResolvedExamId("");
            setSubmission(null);
            setGrade(null);
            setMarksheet(null);
          }
          return;
        }

        const [fetchedSubmissionData, gradeData, marksheetData] = await Promise.all([
          submissionData
            ? Promise.resolve(submissionData)
            : fetch(`/api/files/submissions/${examId}/${submissionId}/submission.json`).then((res) =>
                res.ok ? ((res.json() as Promise<SubmissionData>)) : getDemoSubmission(submissionId, examId)
              ),
          fetch(`/api/files/submissions/${examId}/${submissionId}/grade.json`).then((res) =>
            res.ok
              ? res.json()
              : (() => {
                  const local = getDemoSubmission(submissionId, examId);
                  if (!local || typeof local.score !== "number") return null;
                  return {
                    examId: local.examId,
                    submissionId: local.id,
                    score: local.score,
                    maxScore: local.maxScore ?? 0,
                    feedback: local.feedback ?? "",
                    gradedAt: local.gradedAt ?? local.timestamp,
                    sections: local.sections ?? [],
                  } satisfies GradeData;
                })()
          ),
          fetch(`/api/files/${examId}/marksheet.json`).then((res) => (res.ok ? res.json() : null)),
        ]);

        if (!cancelled) {
          setResolvedExamId(examId);
          setSubmission(fetchedSubmissionData);
          setGrade(gradeData && !gradeData.error ? (gradeData as GradeData) : null);
          setMarksheet(marksheetData as MarksheetSchema | null);
        }
      } catch {
        if (!cancelled) {
          setResolvedExamId("");
          setSubmission(null);
          setGrade(null);
          setMarksheet(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadReview();

    return () => {
      cancelled = true;
    };
  }, [routeExamId, submissionId]);

  const marksheetPayload = useMemo(
    () => (submission ? parseMarksheetSubmission(submission.content) : null),
    [submission]
  );

  const marksheetResults = useMemo(() => {
    if (!marksheet || !marksheetPayload?.answers) return [];

    const scoringRules = buildEffectiveScoringRules(marksheet);
    const questionOutcome = new Map<string, { correctAnswer: string; isCorrect: boolean }>();

    scoringRules.forEach((rule) => {
      const actual = rule.questionIds.map((questionId) => marksheetPayload.answers?.[questionId] ?? "");
      const displayCorrectAnswers = getDisplayCorrectAnswers(rule, actual);
      const isCorrect = matchesScoringRule(rule, actual);

      rule.questionIds.forEach((questionId, index) => {
        questionOutcome.set(questionId, {
          correctAnswer: displayCorrectAnswers[index] ?? "",
          isCorrect,
        });
      });
    });

    return marksheet.questions.map<MarksheetAnswerReview>((question) => {
      const outcome = questionOutcome.get(question.id);
      return {
        id: question.id,
        displayLabel: question.displayLabel ?? String(question.number),
        prompt: question.prompt,
        selectedAnswer: marksheetPayload.answers?.[question.id] ?? "-",
        correctAnswer: outcome?.correctAnswer ?? String(question.correctAnswer ?? "-"),
        isCorrect: outcome?.isCorrect ?? false,
      };
    });
  }, [marksheet, marksheetPayload]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-slate-50 px-6">
        <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="mb-5 text-lg font-bold text-slate-950">結果データが見つかりません。</p>
          <Link
            href="/results"
            className="inline-flex rounded-lg bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700"
          >
            生徒管理画面へ戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-10">
        <div className="mb-6">
          <Link
            href="/results"
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-950"
          >
            <ArrowLeft className="h-4 w-4" />
            生徒管理画面に戻る
          </Link>
        </div>

        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="mb-2 text-sm font-bold tracking-[0.2em] text-blue-700">RESULT REVIEW</p>
          <h1 className="text-3xl font-black text-slate-950">結果の確認</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {submission.examId} / 提出日時 {new Date(submission.timestamp).toLocaleString("ja-JP")}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-black text-slate-950">
              <FileText className="h-5 w-5 text-blue-600" />
              提出した答案
            </h2>

            {submission.images && submission.images.length > 0 && (
              <div className="grid min-w-0 gap-4">
                {submission.images.map((image, index) => {
                  const src = `/api/files/submissions/${resolvedExamId}/${submissionId}/${image}`;
                  return (
                    <button
                      key={image}
                      type="button"
                      onClick={() => setLightboxImage(src)}
                      className="group relative block h-[540px] w-full min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-950 text-left shadow-sm"
                    >
                      <img
                        src={src}
                        alt={`提出答案 ${index + 1}`}
                        className="mx-auto h-full max-h-full max-w-full object-contain"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/25">
                        <ZoomIn className="h-8 w-8 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {submission.content && (
              <div className="mt-4">
                <p className="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-600">
                  <MessageSquare className="h-4 w-4" />
                  {marksheetResults.length > 0 ? "解答チェック" : "テキスト回答"}
                </p>
                {marksheetResults.length > 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                        <p className="text-xs font-bold tracking-[0.18em] text-emerald-700">正解</p>
                        <p className="mt-1 text-2xl font-black text-emerald-900">
                          {marksheetResults.filter((item) => item.isCorrect).length}
                        </p>
                      </div>
                      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
                        <p className="text-xs font-bold tracking-[0.18em] text-rose-700">不正解</p>
                        <p className="mt-1 text-2xl font-black text-rose-900">
                          {marksheetResults.filter((item) => !item.isCorrect).length}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                        <p className="text-xs font-bold tracking-[0.18em] text-slate-500">解答記号数</p>
                        <p className="mt-1 text-2xl font-black text-slate-900">{marksheetResults.length}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {marksheetResults.map((item) => (
                        <div
                          key={item.id}
                          className={`rounded-xl border px-4 py-3 ${
                            item.isCorrect ? "border-emerald-200 bg-white" : "border-rose-200 bg-rose-50/60"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-black text-slate-950">解答記号 {item.displayLabel}</p>
                              {item.prompt && <p className="mt-1 text-xs text-slate-500">{item.prompt}</p>}
                            </div>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ${
                                item.isCorrect
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-rose-100 text-rose-800"
                              }`}
                            >
                              {item.isCorrect ? <CheckCircle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                              {item.isCorrect ? "正解" : "不正解"}
                            </span>
                          </div>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-lg bg-slate-50 px-3 py-2">
                              <p className="text-[11px] font-bold tracking-[0.16em] text-slate-500">あなたの解答</p>
                              <p className="mt-1 text-lg font-black text-slate-950">{item.selectedAnswer}</p>
                            </div>
                            <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-inset ring-slate-200">
                              <p className="text-[11px] font-bold tracking-[0.16em] text-slate-500">正解</p>
                              <p className="mt-1 text-lg font-black text-slate-950">{item.correctAnswer}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-900">
                    {submission.content}
                  </div>
                )}
              </div>
            )}
          </section>

          <aside className="self-start rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-24">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-black text-slate-950">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
              採点結果
            </h2>

            {grade ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-sky-200 bg-[linear-gradient(135deg,#eff6ff_0%,#ecfeff_100%)] p-5 shadow-sm">
                  <p className="text-xs font-bold tracking-[0.24em] text-sky-700">SCORE</p>
                  <p className="mt-2 text-4xl font-black text-slate-950">
                    {grade.score}
                    <span className="text-lg text-slate-600"> / {grade.maxScore}点</span>
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    結果公開 {new Date(grade.gradedAt).toLocaleString("ja-JP")}
                  </p>
                </div>

                {grade.sections.length > 0 && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-3 text-sm font-bold text-slate-700">大問ごとの結果</p>
                    <div className="space-y-3">
                      {grade.sections.map((section) => (
                        <div key={section.id} className="rounded-lg border border-slate-200 bg-white p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-bold text-slate-950">{section.title}</p>
                              <p className="mt-1 text-sm text-slate-600">
                                {section.score} / {section.maxScore}点
                              </p>
                            </div>
                            {section.retryRecommended && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
                                <RotateCcw className="h-3.5 w-3.5" />
                                解きなおし
                              </span>
                            )}
                          </div>
                          {section.feedback && (
                            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                              {section.feedback}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="mb-2 text-sm font-bold text-slate-700">全体講評</p>
                  <p className="whitespace-pre-wrap text-sm leading-7 text-slate-900">
                    {grade.feedback || "講評はまだ入力されていません。"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                まだ採点結果は登録されていません。結果公開までしばらくお待ちください。
              </div>
            )}

            {grade?.sections.some((section) => section.retryRecommended) && (
              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-700" />
                  <div>
                    <p className="font-bold text-blue-950">解きなおし対象があります</p>
                    <p className="mt-1 text-sm leading-6 text-blue-900">
                      大問ごとの講評を見ながら、間違えたところをもう一度解いてみましょう。
                    </p>
                  </div>
                </div>
              </div>
            )}

            <Link
              href={`/exam/${resolvedExamId}`}
              className="mt-5 flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-100"
            >
              再提出する
            </Link>
          </aside>
        </div>
      </div>

      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/90 p-4 md:p-8"
          onClick={() => setLightboxImage(null)}
        >
          <button
            className="absolute right-5 top-5 text-white/70 transition-colors hover:text-white"
            onClick={() => setLightboxImage(null)}
            aria-label="拡大表示を閉じる"
          >
            <X className="h-8 w-8" />
          </button>
          <img
            src={lightboxImage}
            alt="拡大表示"
            className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
