"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { ArrowLeft, BookOpen, ClipboardCheck, Clock, GraduationCap, Headphones, LogIn, PlayCircle } from "lucide-react";
import { videoSkillLabels } from "@/lib/video-labels";
import { isIijVideoUrl, toProxiedVideoUrl } from "@/lib/video-proxy";
import { getVideoReturnPath } from "@/lib/video-return";
import type { VideoLesson, VideoProgress } from "@/types/video";

type User = { id: string; name: string; role: "student" | "teacher" };

const VIDEO_PROGRESS_STORAGE_VERSION = "v2";

function storedProgressKey(userId: string) {
  return `video-progress:${VIDEO_PROGRESS_STORAGE_VERSION}:${userId}`;
}

function legacyStoredProgressKey(userId: string) {
  return `video-progress:${userId}`;
}

function readStoredProgress(userId: string) {
  try {
    window.localStorage.removeItem(legacyStoredProgressKey(userId));
    const raw = window.localStorage.getItem(storedProgressKey(userId));
    const records = raw ? (JSON.parse(raw) as VideoProgress[]) : [];
    return Array.isArray(records) ? records.filter((record) => record.userId === userId) : [];
  } catch {
    return [];
  }
}

function saveStoredProgress(record: VideoProgress) {
  const records = readStoredProgress(record.userId);
  const index = records.findIndex((item) => item.lessonId === record.lessonId);
  const nextRecords =
    index >= 0 ? records.map((item, itemIndex) => (itemIndex === index ? record : item)) : [...records, record];
  window.localStorage.setItem(storedProgressKey(record.userId), JSON.stringify(nextRecords));
}

export default function VideoLessonPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const lessonId = params.id;
  const [user, setUser] = useState<User | null>(null);
  const [lesson, setLesson] = useState<VideoLesson | null>(null);
  const [loading, setLoading] = useState(true);
  const progressSavedRef = useRef(false);

  useEffect(() => {
    progressSavedRef.current = false;
  }, [lessonId]);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then((res) => (res.ok ? res.json() : { user: null })),
      fetch(`/api/video-lessons?id=${encodeURIComponent(lessonId)}`).then((res) => (res.ok ? res.json() : null)),
    ])
      .then(([me, lessonData]) => {
        setUser(me.user);
        setLesson(lessonData);
      })
      .catch(() => {
        setUser(null);
        setLesson(null);
      })
      .finally(() => setLoading(false));
  }, [lessonId]);

  useEffect(() => {
    if (!user || !lesson || progressSavedRef.current) return;
    progressSavedRef.current = true;

    const storageKey = `video-progress-marked:${lesson.id}`;
    if (window.sessionStorage.getItem(storageKey) === "1") {
      window.sessionStorage.removeItem(storageKey);
      return;
    }

    const storedRecord = readStoredProgress(user.id).find((record) => record.lessonId === lesson.id);
    saveStoredProgress({
      userId: user.id,
      lessonId: lesson.id,
      watched: true,
      watchedAt: new Date().toISOString(),
      watchCount: (storedRecord?.watchCount ?? 0) + 1,
    });

    const payload = JSON.stringify({ lessonId: lesson.id });
    fetch("/api/video-progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: payload,
    }).catch(() => {
      progressSavedRef.current = false;
    });
  }, [lesson, user]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "video-player-close") return;
      router.push(typeof event.data.returnTo === "string" ? event.data.returnTo : getVideoReturnPath(lesson));
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [lesson, router]);

  const returnPath = useMemo(() => getVideoReturnPath(lesson), [lesson]);

  const embedUrl = useMemo(() => {
    if (!lesson) return "";
    if (lesson.provider === "iframe") {
      if (!lesson.videoUrl) return "";
      const proxied = toProxiedVideoUrl(lesson.videoUrl, returnPath);
      const separator = proxied.includes("?") ? "&" : "?";
      return `${proxied}${separator}proxyv=20260508b`;
    }
    return "";
  }, [lesson, returnPath]);

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

  if (!lesson) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Link href={returnPath} className="glass-pill inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-[#dbe7ff]">
          <ArrowLeft className="h-4 w-4" />
          映像講座へ
        </Link>
        <div className="glass-card mt-6 rounded-[28px] p-8 text-center">
          <p className="text-xl font-black text-slate-950">映像講座が見つかりません</p>
        </div>
      </div>
    );
  }

  const isSecondaryLesson = lesson.subject === "secondary";
  const SkillIcon = isSecondaryLesson ? GraduationCap : lesson.skill === "listening" ? Headphones : BookOpen;

  return (
    <div className="min-h-screen text-slate-950">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-10">
        <div className="mb-6">
          <Link href={returnPath} className="glass-pill inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-[#dbe7ff] hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            映像講座へ
          </Link>
        </div>

        <section className="glass-card mb-6 rounded-[30px] p-5 content-on-light">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
                  <SkillIcon className="h-4 w-4" />
                  {videoSkillLabels[lesson.skill]}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
                  <Clock className="h-4 w-4" />
                  {lesson.duration}
                </span>
              </div>
              <h1 className="text-2xl font-black text-slate-950 md:text-4xl">
                {lesson.sequence}. {lesson.title}
              </h1>
              <p className="mt-3 text-sm font-bold text-slate-600">
                {lesson.courseName} / {lesson.chapter} / {lesson.sectionNo}. {lesson.sectionTitle}
              </p>
              <p className="mt-1 text-sm font-bold text-slate-500">{lesson.teacher}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {lesson.hasQuiz && (
                <Link
                  href={`/videos/${lesson.id}/quiz`}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-[0_12px_30px_rgba(5,150,105,0.24)] hover:bg-emerald-500"
                >
                  <ClipboardCheck className="h-5 w-5" />
                  確認問題
                </Link>
              )}
              {(!isSecondaryLesson || embedUrl) && (
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-sm font-black text-white">
                  <PlayCircle className="h-5 w-5" />
                  視聴中
                </div>
              )}
            </div>
          </div>
        </section>

        {isSecondaryLesson && !embedUrl ? (
          <section className="glass-card-soft rounded-[28px] p-8 text-center shadow-[0_24px_80px_rgba(5,12,28,0.22)]">
            <p className="text-2xl font-black text-slate-950">目次は準備中です</p>
            <p className="mt-3 text-sm font-bold leading-7 text-slate-600">
              この大学別対策講座の詳細目次は、あとから登録できるようにしてあります。
            </p>
          </section>
        ) : (
          <section className="overflow-hidden rounded-[28px] border border-white/20 bg-slate-950 shadow-[0_24px_80px_rgba(5,12,28,0.35)]">
            <div className="aspect-video w-full bg-black">
              {embedUrl && (
                <iframe
                  className="h-full w-full"
                  src={embedUrl}
                  title={lesson.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
