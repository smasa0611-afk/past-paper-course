"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle,
  FileText,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  Plus,
  Save,
  Star,
  Trash2,
  X,
  ZoomIn,
} from "lucide-react";
import type { GradeData, SectionGrade } from "@/types/grading";
import { getDemoSubmission, upsertDemoSubmission } from "@/lib/demo-submissions";

type SubmissionData = {
  id: string;
  examId: string;
  studentId: string;
  content: string;
  images: string[];
  timestamp: string;
  status: string;
};

type SectionInput = {
  id: string;
  title: string;
  score: string;
  maxScore: string;
  feedback: string;
  retryRecommended: boolean;
};

function createSection(index: number): SectionInput {
  return {
    id: `section-${Date.now()}-${index}`,
    title: `大問${index + 1}`,
    score: "0",
    maxScore: "0",
    feedback: "",
    retryRecommended: false,
  };
}

function toSectionInput(section: SectionGrade, index: number): SectionInput {
  return {
    id: section.id || `section-${index + 1}`,
    title: section.title || `大問${index + 1}`,
    score: String(section.score ?? 0),
    maxScore: String(section.maxScore ?? 0),
    feedback: section.feedback || "",
    retryRecommended: Boolean(section.retryRecommended),
  };
}

export default function GradingDetailPage(props: {
  params: Promise<{ id: string[] }>;
}) {
  const params = use(props.params);
  const idParts = params.id;
  const submissionId = idParts[idParts.length - 1];
  const examId = idParts.slice(0, -1).join("/");

  const [submission, setSubmission] = useState<SubmissionData | null>(null);
  const [rubricText, setRubricText] = useState("");
  const [existingGrade, setExistingGrade] = useState<GradeData | null>(null);
  const [sections, setSections] = useState<SectionInput[]>([createSection(0)]);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/files/submissions/${examId}/${submissionId}/submission.json`).then((res) =>
        res.ok ? res.json() : getDemoSubmission(submissionId, examId)
      ),
      fetch(`/api/files/${examId}/rubric.md`).then((res) => (res.ok ? res.text() : "")),
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
    ])
      .then(([submissionData, rubricData, gradeData]) => {
        setSubmission(submissionData);
        setRubricText(rubricData || "");

        if (gradeData && !gradeData.error) {
          const normalized = gradeData as GradeData;
          setExistingGrade(normalized);
          setFeedback(normalized.feedback || "");
          if (Array.isArray(normalized.sections) && normalized.sections.length > 0) {
            setSections(normalized.sections.map(toSectionInput));
          }
        }
      })
      .catch(() => {
        setSubmission(null);
      })
      .finally(() => setLoading(false));
  }, [examId, submissionId]);

  const totalScore = useMemo(
    () => sections.reduce((sum, section) => sum + (Number(section.score) || 0), 0),
    [sections]
  );

  const totalMaxScore = useMemo(
    () => sections.reduce((sum, section) => sum + (Number(section.maxScore) || 0), 0),
    [sections]
  );

  const rubricHtml = useMemo(() => {
    if (!rubricText) return "";
    return rubricText
      .replace(/^### (.*$)/gm, '<h4 class="mt-4 mb-1 text-sm font-bold text-slate-900">$1</h4>')
      .replace(/^## (.*$)/gm, '<h3 class="mt-5 mb-2 text-base font-bold text-slate-950">$1</h3>')
      .replace(/^# (.*$)/gm, '<h2 class="mt-6 mb-3 text-lg font-black text-slate-950">$1</h2>')
      .replace(/^- (.*$)/gm, '<li class="ml-4 mb-1 list-disc text-sm leading-6 text-slate-700">$1</li>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-950">$1</strong>')
      .replace(/\n\n/g, "<br/>");
  }, [rubricText]);

  const updateSection = (index: number, patch: Partial<SectionInput>) => {
    setSections((current) =>
      current.map((section, currentIndex) =>
        currentIndex === index ? { ...section, ...patch } : section
      )
    );
  };

  const addSection = () => {
    setSections((current) => [...current, createSection(current.length)]);
  };

  const removeSection = (index: number) => {
    setSections((current) =>
      current.length === 1 ? current : current.filter((_, currentIndex) => currentIndex !== index)
    );
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setSuccess(false);

    try {
      const payload = {
        examId,
        submissionId,
        feedback,
        sections: sections.map((section, index) => ({
          id: section.id || `section-${index + 1}`,
          title: section.title || `大問${index + 1}`,
          score: Number(section.score) || 0,
          maxScore: Number(section.maxScore) || 0,
          feedback: section.feedback,
          retryRecommended: section.retryRecommended,
        })),
      };

      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        return;
      }

      setExistingGrade(data.grade as GradeData);
      if (submission) {
        upsertDemoSubmission({
          ...submission,
          status: "graded",
          score: (data.grade as GradeData).score,
          maxScore: (data.grade as GradeData).maxScore,
          feedback: (data.grade as GradeData).feedback,
          gradedAt: (data.grade as GradeData).gradedAt,
          sections: (data.grade as GradeData).sections,
        });
      }
      setSuccess(true);
    } finally {
      setSubmitting(false);
    }
  };

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
          <p className="mb-5 text-lg font-bold text-slate-950">提出データが見つかりません。</p>
          <Link
            href="/grading"
            className="inline-flex rounded-lg bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700"
          >
            一覧に戻る
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto w-full max-w-[1700px] px-4 py-6 md:px-6 md:py-8">
        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <Link
                href="/grading"
                className="mt-1 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100"
                aria-label="採点一覧に戻る"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div>
                <p className="mb-1 text-xs font-bold tracking-[0.18em] text-blue-700">SCORING STAFF</p>
                <h1 className="text-2xl font-black text-slate-950">採点スタッフ入力 - {submission.studentId}</h1>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {submission.examId} / 提出日時 {new Date(submission.timestamp).toLocaleString("ja-JP")}
                </p>
              </div>
            </div>

            <div className="inline-flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <p className="text-xs font-bold text-slate-500">合計点</p>
                <p className="text-2xl font-black text-slate-950">
                  {totalScore}
                  <span className="ml-1 text-base text-slate-500">/ {totalMaxScore || 0}</span>
                </p>
              </div>
              {existingGrade && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
                  保存済み
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_520px]">
          <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-slate-950">
              <FileText className="h-5 w-5 text-blue-600" />
              生徒の解答
            </h2>

            {submission.images && submission.images.length > 0 && (
              <div className="mb-6">
                <p className="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-600">
                  <ImageIcon className="h-4 w-4" />
                  アップロード画像 ({submission.images.length}枚)
                </p>
                <div className="grid min-w-0 gap-4">
                  {submission.images.map((image, index) => {
                    const src = `/api/files/submissions/${examId}/${submissionId}/${image}`;
                    return (
                      <button
                        key={image}
                        type="button"
                        className="group relative block h-[560px] w-full min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-950 text-left shadow-sm"
                        onClick={() => setLightboxImage(src)}
                      >
                        <img
                          src={src}
                          alt={`提出画像 ${index + 1}`}
                          className="mx-auto h-full max-h-full max-w-full object-contain"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/25">
                          <ZoomIn className="h-8 w-8 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {submission.content && (
              <div>
                <p className="mb-3 flex items-center gap-1.5 text-sm font-bold text-slate-600">
                  <MessageSquare className="h-4 w-4" />
                  テキスト解答
                </p>
                <div className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-900">
                  {submission.content}
                </div>
              </div>
            )}
          </section>

          <aside className="self-start rounded-lg border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-24 md:p-5">
            {rubricHtml && (
              <section className="mb-6">
                <h2 className="mb-3 flex items-center gap-2 text-lg font-black text-slate-950">
                  <Star className="h-5 w-5 text-amber-500" />
                  採点基準
                </h2>
                <div className="max-h-[220px] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div dangerouslySetInnerHTML={{ __html: rubricHtml }} />
                </div>
              </section>
            )}

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-black text-slate-950">
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                  大問ごとの採点入力
                </h2>
                <button
                  type="button"
                  onClick={addSection}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  <Plus className="h-4 w-4" />
                  追加
                </button>
              </div>

              {success && (
                <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
                  採点結果を保存しました。
                </div>
              )}

              <form onSubmit={handleSave} className="grid gap-4">
                <div className="grid gap-3">
                  {sections.map((section, index) => (
                    <div key={section.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <input
                          value={section.title}
                          onChange={(event) => updateSection(index, { title: event.target.value })}
                          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                          placeholder={`大問${index + 1}`}
                        />
                        <button
                          type="button"
                          onClick={() => removeSection(index)}
                          disabled={sections.length === 1}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                          aria-label="大問を削除"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
                        <label className="grid gap-2">
                          <span className="text-xs font-bold text-slate-600">点数</span>
                          <input
                            type="number"
                            min="0"
                            value={section.score}
                            onChange={(event) => updateSection(index, { score: event.target.value })}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                          />
                        </label>
                        <label className="grid gap-2">
                          <span className="text-xs font-bold text-slate-600">満点</span>
                          <input
                            type="number"
                            min="0"
                            value={section.maxScore}
                            onChange={(event) => updateSection(index, { maxScore: event.target.value })}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                          />
                        </label>
                      </div>

                      <label className="mt-3 grid gap-2">
                        <span className="text-xs font-bold text-slate-600">大問コメント</span>
                        <textarea
                          value={section.feedback}
                          onChange={(event) => updateSection(index, { feedback: event.target.value })}
                          className="min-h-[96px] rounded-lg border border-slate-300 bg-white p-3 text-sm leading-6 text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                          placeholder="この大問で良かった点、途中式、減点理由、次回への助言など"
                        />
                      </label>

                      <label className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-slate-700">
                        <input
                          type="checkbox"
                          checked={section.retryRecommended}
                          onChange={(event) =>
                            updateSection(index, { retryRecommended: event.target.checked })
                          }
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        この大問は解きなおし対象にする
                      </label>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">全体コメント</label>
                  <textarea
                    value={feedback}
                    onChange={(event) => setFeedback(event.target.value)}
                    className="min-h-[140px] w-full rounded-lg border border-slate-300 bg-white p-4 text-sm leading-6 text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    placeholder="答案全体の講評や、次回までの学習アドバイスなど"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-600"
                >
                  {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-4 w-4" />}
                  {submitting ? "保存中..." : "採点結果を保存"}
                </button>
              </form>
            </section>
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
