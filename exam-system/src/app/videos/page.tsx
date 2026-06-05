"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, ClipboardCheck, FileText, GraduationCap, Headphones, LogIn, PlayCircle, Search, ShieldCheck } from "lucide-react";
import { videoSkillLabels } from "@/lib/video-labels";
import type { VideoLessonListItem, VideoProgress, VideoSkill } from "@/types/video";

type User = { id: string; name: string; role: "student" | "teacher" };
type VideoMode = "common" | "secondary";
type MajorSkillFilter = "all" | "english" | "math" | "japanese" | "science" | "social" | "information";
type LessonStatus = "unwatched" | "watched" | "rewatched";
type LessonAccent = {
  line: string;
  chip: string;
  progress: string;
  button: string;
  row: string;
  surface: string;
};
type CourseGoal = {
  university: string;
  faculty: string;
  department: string;
  admissionType?: string;
} | null;
type CourseProfile = {
  goal: CourseGoal;
  enrollments: {
    courseCode?: string;
    grade?: string;
    courseName?: string;
    courseCategory?: string;
    year?: string;
  }[];
  hasSecondaryCourse: boolean;
  secondaryCourses?: {
    courseCode?: string;
    courseName?: string;
    courseCategory?: string;
    targetKey?: string;
  }[];
};
type CourseGroup = {
  key: string;
  modeLabel: string;
  skill: VideoSkill;
  accentCategory: Exclude<MajorSkillFilter, "all">;
  title: string;
  courseName: string;
  teacher: string;
  materialPdfUrl?: string | null;
  lessons: VideoLessonListItem[];
  watchedCount: number;
};

const VIDEO_PROGRESS_STORAGE_VERSION = "v2";
const PAGE_SIZE = 12;
const majorSkillOrder: Exclude<MajorSkillFilter, "all">[] = ["english", "math", "japanese", "science", "social", "information"];
const majorSkillLabels: Record<Exclude<MajorSkillFilter, "all">, string> = {
  english: "英語",
  math: "数学",
  japanese: "国語",
  science: "理科",
  social: "社会",
  information: "情報",
};

const lessonAccents: Record<Exclude<MajorSkillFilter, "all"> | "secondary", LessonAccent> = {
  english: {
    line: "border-l-red-500",
    chip: "bg-red-500/18 text-red-50 ring-red-300/45 shadow-[0_0_18px_rgba(239,68,68,0.18)]",
    progress: "bg-red-500",
    button: "border-red-200/45 bg-red-500/16 text-red-50 hover:bg-red-500 hover:text-white",
    row: "hover:bg-red-500/10",
    surface: "bg-red-500/10 hover:bg-red-500/15",
  },
  math: {
    line: "border-l-emerald-500",
    chip: "bg-emerald-500/18 text-emerald-50 ring-emerald-300/45 shadow-[0_0_18px_rgba(16,185,129,0.18)]",
    progress: "bg-emerald-500",
    button: "border-emerald-200/45 bg-emerald-500/16 text-emerald-50 hover:bg-emerald-500 hover:text-white",
    row: "hover:bg-emerald-500/10",
    surface: "bg-emerald-500/10 hover:bg-emerald-500/15",
  },
  japanese: {
    line: "border-l-orange-400",
    chip: "bg-orange-400/20 text-orange-50 ring-orange-200/50 shadow-[0_0_18px_rgba(251,146,60,0.2)]",
    progress: "bg-orange-400",
    button: "border-orange-100/50 bg-orange-400/18 text-orange-50 hover:bg-orange-400 hover:text-slate-950",
    row: "hover:bg-orange-400/10",
    surface: "bg-orange-400/10 hover:bg-orange-400/15",
  },
  science: {
    line: "border-l-violet-500",
    chip: "bg-violet-500/20 text-violet-50 ring-violet-300/50 shadow-[0_0_18px_rgba(139,92,246,0.22)]",
    progress: "bg-violet-500",
    button: "border-violet-200/45 bg-violet-500/18 text-violet-50 hover:bg-violet-500 hover:text-white",
    row: "hover:bg-violet-500/10",
    surface: "bg-violet-500/10 hover:bg-violet-500/15",
  },
  social: {
    line: "border-l-blue-500",
    chip: "bg-blue-500/20 text-blue-50 ring-blue-300/50 shadow-[0_0_18px_rgba(59,130,246,0.2)]",
    progress: "bg-blue-500",
    button: "border-blue-200/45 bg-blue-500/18 text-blue-50 hover:bg-blue-500 hover:text-white",
    row: "hover:bg-blue-500/10",
    surface: "bg-blue-500/10 hover:bg-blue-500/15",
  },
  information: {
    line: "border-l-cyan-400",
    chip: "bg-cyan-400/16 text-cyan-50 ring-cyan-300/40 shadow-[0_0_18px_rgba(34,211,238,0.16)]",
    progress: "bg-cyan-400",
    button: "border-cyan-200/40 bg-cyan-400/14 text-cyan-50 hover:bg-cyan-400 hover:text-slate-950",
    row: "hover:bg-cyan-400/10",
    surface: "bg-cyan-400/10 hover:bg-cyan-400/15",
  },
  secondary: {
    line: "border-l-fuchsia-400",
    chip: "bg-fuchsia-400/16 text-fuchsia-100 ring-fuchsia-300/35 shadow-[0_0_18px_rgba(232,121,249,0.16)]",
    progress: "bg-fuchsia-400",
    button: "border-fuchsia-200/35 bg-fuchsia-400/12 text-fuchsia-50 hover:bg-fuchsia-500 hover:text-white",
    row: "hover:bg-fuchsia-400/8",
    surface: "bg-fuchsia-400/10 hover:bg-fuchsia-400/15",
  },
};

function storedProgressKey(userId: string) {
  return `video-progress:${VIDEO_PROGRESS_STORAGE_VERSION}:${userId}`;
}

function legacyStoredProgressKey(userId: string) {
  return `video-progress:${userId}`;
}

function isSecondaryLesson(lesson: VideoLessonListItem) {
  return lesson.subject === "secondary" || lesson.skill.startsWith("secondary_");
}

function lessonModeLabel(lesson: VideoLessonListItem) {
  return isSecondaryLesson(lesson) ? "2次対策" : "共通テスト";
}

function lessonModeFullLabel(mode: VideoMode) {
  return mode === "secondary" ? "2次対策『大学別特講』" : "共通テスト対策『レベルアップ講座』";
}

function lessonModeTabLabel(mode: VideoMode) {
  return mode === "secondary"
    ? { category: "2次対策", title: "大学別特講" }
    : { category: "共通テスト対策", title: "レベルアップ講座" };
}

function skillIcon(skill: VideoSkill) {
  if (skill === "listening") return <Headphones className="h-4 w-4" />;
  if (skill.startsWith("secondary_")) return <GraduationCap className="h-4 w-4" />;
  return <BookOpen className="h-4 w-4" />;
}

function majorCategoryForLesson(lesson: VideoLessonListItem): Exclude<MajorSkillFilter, "all"> {
  if (lesson.skill === "reading" || lesson.skill === "listening") return "english";
  if (lesson.skill === "math_ia" || lesson.skill === "math_iibc") return "math";
  if (["world_history", "world_history_new_trends", "japanese_history", "geography", "geography_practice", "politics_economics", "public_civics", "ethics"].includes(lesson.skill)) {
    return "social";
  }
  if (lesson.skill.startsWith("japanese_")) return "japanese";
  if (["physics", "physics_basic", "chemistry", "chemistry_basic", "biology", "biology_basic", "earth_science_basic"].includes(lesson.skill)) {
    return "science";
  }
  if (lesson.skill === "information_i") return "information";

  const haystack = [lesson.courseName, lesson.chapter, lesson.sectionTitle, lesson.title, videoSkillLabels[lesson.skill]].join(" ");
  if (/英語|英文|リーディング|リスニング/.test(haystack)) return "english";
  if (/数学|数[IAⅡIIＢBC]|微分|積分|関数|確率/.test(haystack)) return "math";
  if (/国語|現代文|古文|漢文|小論文/.test(haystack)) return "japanese";
  if (/理科|物理|化学|生物|地学/.test(haystack)) return "science";
  if (/社会|世界史|日本史|地理|政治|経済|倫理|公共/.test(haystack)) return "social";
  if (/情報/.test(haystack)) return "information";
  return "english";
}

function majorCategoryForSkill(skill: VideoSkill): Exclude<MajorSkillFilter, "all"> | "secondary" {
  if (skill.startsWith("secondary_")) return "secondary";
  if (skill === "reading" || skill === "listening") return "english";
  if (skill === "math_ia" || skill === "math_iibc") return "math";
  if (["world_history", "world_history_new_trends", "japanese_history", "geography", "geography_practice", "politics_economics", "public_civics", "ethics"].includes(skill)) return "social";
  if (skill.startsWith("japanese_")) return "japanese";
  if (["physics", "physics_basic", "chemistry", "chemistry_basic", "biology", "biology_basic", "earth_science_basic"].includes(skill)) return "science";
  if (skill === "information_i") return "information";
  return "social";
}

function lessonAccent(skill: VideoSkill, category?: Exclude<MajorSkillFilter, "all">) {
  return lessonAccents[category ?? majorCategoryForSkill(skill)];
}

function filterAccentClass(category: Exclude<MajorSkillFilter, "all">, active: boolean) {
  const styles: Record<Exclude<MajorSkillFilter, "all">, { active: string; idle: string }> = {
    english: {
      active: "border-red-300 bg-red-500 text-white shadow-[0_0_22px_rgba(239,68,68,0.34)]",
      idle: "border-red-300/30 bg-red-500/10 text-red-50 hover:bg-red-500/18",
    },
    math: {
      active: "border-emerald-300 bg-emerald-500 text-white shadow-[0_0_22px_rgba(16,185,129,0.32)]",
      idle: "border-emerald-300/30 bg-emerald-500/10 text-emerald-50 hover:bg-emerald-500/18",
    },
    japanese: {
      active: "border-orange-200 bg-orange-400 text-slate-950 shadow-[0_0_22px_rgba(251,146,60,0.34)]",
      idle: "border-orange-200/30 bg-orange-400/12 text-orange-50 hover:bg-orange-400/20",
    },
    science: {
      active: "border-violet-300 bg-violet-500 text-white shadow-[0_0_22px_rgba(139,92,246,0.34)]",
      idle: "border-violet-300/30 bg-violet-500/12 text-violet-50 hover:bg-violet-500/20",
    },
    social: {
      active: "border-blue-300 bg-blue-500 text-white shadow-[0_0_22px_rgba(59,130,246,0.34)]",
      idle: "border-blue-300/30 bg-blue-500/12 text-blue-50 hover:bg-blue-500/20",
    },
    information: {
      active: "border-cyan-300 bg-cyan-500 text-slate-950 shadow-[0_0_22px_rgba(34,211,238,0.28)]",
      idle: "border-cyan-300/30 bg-cyan-500/10 text-cyan-50 hover:bg-cyan-500/18",
    },
  };
  return active ? styles[category].active : styles[category].idle;
}

function progressFillClass(percent: number, accent: LessonAccent) {
  if (percent >= 100) return "bg-emerald-400";
  if (percent > 0) return accent.progress;
  return "bg-slate-500/70";
}

function formatDate(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatGoal(goal: CourseGoal) {
  if (!goal?.university) return "未取込";
  return [goal.university, goal.faculty, goal.department].filter(Boolean).join(" ");
}

function formatEnrollment(profile: CourseProfile | null) {
  const names = profile?.enrollments.map((item) => item.courseName).filter(Boolean) ?? [];
  return names.length > 0 ? names.join(" / ") : "受講コース未取込";
}

function getLessonStatus(progress?: VideoProgress): LessonStatus {
  if (!progress?.watched) return "unwatched";
  return (progress.watchCount ?? 0) > 1 ? "rewatched" : "watched";
}

function getStatusLabel(status: LessonStatus) {
  if (status === "rewatched") return "重視聴";
  if (status === "watched") return "視聴済";
  return "未視聴";
}

function statusClass(status: LessonStatus) {
  if (status === "rewatched") return "bg-purple-500 text-white shadow-[0_0_18px_rgba(168,85,247,0.35)] ring-purple-200/55";
  if (status === "watched") return "bg-blue-500 text-white shadow-[0_0_18px_rgba(59,130,246,0.35)] ring-blue-200/55";
  return "bg-slate-500/75 text-white ring-slate-200/35";
}

function extractCoursePhase(lesson: VideoLessonListItem) {
  if (isSecondaryLesson(lesson)) return "";
  const source = `${lesson.chapter} ${lesson.sectionTitle} ${lesson.title}`;
  const bracket = source.match(/【([^】]+)】/);
  if (bracket?.[1]) return bracket[1].trim();
  if (source.includes("理論編")) return "理論編";
  if (source.includes("実践編")) return "実践編";
  return "";
}

function courseDisplayTitle(lesson: VideoLessonListItem) {
  const phase = extractCoursePhase(lesson);
  return phase ? `${lesson.courseName} ${phase}` : lesson.courseName;
}

function buildCourseKey(lesson: VideoLessonListItem) {
  return [lessonModeLabel(lesson), lesson.skill, lesson.courseName, lesson.teacher, extractCoursePhase(lesson)].join("__");
}

function mergeProgressRecords(records: VideoProgress[]) {
  const merged = new Map<string, VideoProgress>();
  records.forEach((record) => {
    const existing = merged.get(record.lessonId);
    if (!existing) {
      merged.set(record.lessonId, record);
      return;
    }

    const existingTime = new Date(existing.watchedAt).getTime();
    const recordTime = new Date(record.watchedAt).getTime();
    merged.set(record.lessonId, {
      ...existing,
      ...record,
      watched: existing.watched || record.watched,
      watchedAt: recordTime >= existingTime ? record.watchedAt : existing.watchedAt,
      watchCount: Math.max(existing.watchCount ?? 0, record.watchCount ?? 0),
    });
  });
  return [...merged.values()];
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
  const records = mergeProgressRecords([...readStoredProgress(record.userId), record]);
  window.localStorage.setItem(storedProgressKey(record.userId), JSON.stringify(records));
}

export default function VideosPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [courseProfile, setCourseProfile] = useState<CourseProfile | null>(null);
  const [lessons, setLessons] = useState<VideoLessonListItem[]>([]);
  const [progressRecords, setProgressRecords] = useState<VideoProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<VideoMode>(() => {
    if (typeof window === "undefined") return "common";
    return new URLSearchParams(window.location.search).get("mode") === "secondary" ? "secondary" : "common";
  });
  const [skill, setSkill] = useState<MajorSkillFilter>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedCourseKey, setSelectedCourseKey] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then((res) => (res.ok ? res.json() : { user: null })),
      fetch("/api/student-course-profile").then((res) => (res.ok ? res.json() : null)),
      fetch("/api/video-lessons").then((res) => (res.ok ? res.json() : [])),
      fetch("/api/video-progress", { cache: "no-store" }).then((res) => (res.ok ? res.json() : [])),
    ])
      .then(([me, profileData, lessonData, progressData]) => {
        const currentUser = me.user as User | null;
        setUser(currentUser);
        setCourseProfile(profileData as CourseProfile | null);
        setLessons(Array.isArray(lessonData) ? lessonData : []);
        const serverProgress = Array.isArray(progressData) ? progressData : [];
        setProgressRecords(currentUser ? mergeProgressRecords([...serverProgress, ...readStoredProgress(currentUser.id)]) : serverProgress);
      })
      .catch(() => {
        setUser(null);
        setCourseProfile(null);
        setLessons([]);
        setProgressRecords([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const progressMap = useMemo(() => new Map(progressRecords.map((record) => [record.lessonId, record])), [progressRecords]);
  const commonLessons = useMemo(() => lessons.filter((lesson) => !isSecondaryLesson(lesson)), [lessons]);
  const secondaryLessons = useMemo(
    () => (courseProfile?.hasSecondaryCourse ? lessons.filter((lesson) => isSecondaryLesson(lesson)) : []),
    [courseProfile?.hasSecondaryCourse, lessons],
  );
  const hasSecondaryLessons = secondaryLessons.length > 0;
  const hasTodaiSecondaryCourse = useMemo(() => {
    const secondaryCourses = courseProfile?.secondaryCourses ?? [];
    return secondaryCourses.some((course) => {
      const text = `${course.courseCode ?? ""} ${course.courseName ?? ""} ${course.courseCategory ?? ""} ${course.targetKey ?? ""}`;
      return course.targetKey === "todai" || course.courseCode === "101" || text.includes("東大") || text.includes("東京大学");
    });
  }, [courseProfile?.secondaryCourses]);

  useEffect(() => {
    if (mode === "secondary" && !hasSecondaryLessons && !loading) {
      setMode("common");
      setSkill("all");
      setPage(1);
      setSelectedCourseKey(null);
    }
  }, [hasSecondaryLessons, loading, mode]);

  const modeLessons = mode === "secondary" ? secondaryLessons : commonLessons;
  const skillCounts = useMemo(() => {
    return modeLessons.reduce((counts, lesson) => {
      const category = majorCategoryForLesson(lesson);
      counts.set(category, (counts.get(category) ?? 0) + 1);
      return counts;
    }, new Map<Exclude<MajorSkillFilter, "all">, number>());
  }, [modeLessons]);

  const availableFilters = useMemo(() => {
    const found = new Set(modeLessons.map((lesson) => majorCategoryForLesson(lesson)));
    return majorSkillOrder.filter((item) => found.has(item));
  }, [modeLessons]);

  const filteredLessons = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return modeLessons.filter((lesson) => {
      if (skill !== "all" && majorCategoryForLesson(lesson) !== skill) return false;
      if (!normalizedQuery) return true;
      return [courseDisplayTitle(lesson), lesson.chapter, lesson.sectionTitle, lesson.title, lesson.teacher, videoSkillLabels[lesson.skill]]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [modeLessons, query, skill]);

  const courseGroups = useMemo<CourseGroup[]>(() => {
    const grouped = new Map<string, CourseGroup>();
    filteredLessons.forEach((lesson) => {
      const key = buildCourseKey(lesson);
      const progress = progressMap.get(lesson.id);
      const existing = grouped.get(key);
      if (existing) {
        existing.lessons.push(lesson);
        if (progress?.watched) existing.watchedCount += 1;
        return;
      }
      grouped.set(key, {
        key,
        modeLabel: lessonModeLabel(lesson),
        skill: lesson.skill,
        accentCategory: majorCategoryForLesson(lesson),
        title: courseDisplayTitle(lesson),
        courseName: lesson.courseName,
        teacher: lesson.teacher,
        materialPdfUrl: lesson.materialPdfUrl ?? null,
        lessons: [lesson],
        watchedCount: progress?.watched ? 1 : 0,
      });
    });
    return [...grouped.values()].sort((a, b) => a.title.localeCompare(b.title, "ja"));
  }, [filteredLessons, progressMap]);

  const selectedCourse = useMemo(
    () => courseGroups.find((group) => group.key === selectedCourseKey) ?? null,
    [courseGroups, selectedCourseKey],
  );

  useEffect(() => {
    if (typeof window === "undefined" || selectedCourseKey || courseGroups.length === 0) return;
    const requestedCourseKey = new URLSearchParams(window.location.search).get("courseKey");
    if (requestedCourseKey && courseGroups.some((group) => group.key === requestedCourseKey)) {
      setSelectedCourseKey(requestedCourseKey);
    }
  }, [courseGroups, selectedCourseKey]);

  useEffect(() => {
    setPage(1);
    setSelectedCourseKey(null);
  }, [mode, query, skill]);

  const pageCount = Math.max(1, Math.ceil(courseGroups.length / PAGE_SIZE));
  const visibleCourseGroups = courseGroups.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const visibleAllLessons = [...commonLessons, ...secondaryLessons];
  const commonUnwatched = commonLessons.filter((lesson) => !progressMap.get(lesson.id)?.watched).length;
  const secondaryUnwatched = secondaryLessons.filter((lesson) => !progressMap.get(lesson.id)?.watched).length;
  const watchedTotal = visibleAllLessons.filter((lesson) => progressMap.get(lesson.id)?.watched).length;
  const progressPercent = visibleAllLessons.length > 0 ? Math.round((watchedTotal / visibleAllLessons.length) * 100) : 0;

  const recentLessons = useMemo(() => {
    const lessonMap = new Map(visibleAllLessons.map((lesson) => [lesson.id, lesson]));
    return [...progressRecords]
      .filter((record) => record.watched && lessonMap.has(record.lessonId))
      .sort((left, right) => new Date(right.watchedAt).getTime() - new Date(left.watchedAt).getTime())
      .slice(0, 5)
      .map((record) => ({ record, lesson: lessonMap.get(record.lessonId)! }));
  }, [visibleAllLessons, progressRecords]);

  const refreshProgressRecords = useCallback(() => {
    if (!user) return;
    fetch("/api/video-progress", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : []))
      .then((progressData) => {
        const serverProgress = Array.isArray(progressData) ? progressData : [];
        setProgressRecords(mergeProgressRecords([...serverProgress, ...readStoredProgress(user.id)]));
      })
      .catch(() => setProgressRecords((records) => mergeProgressRecords([...records, ...readStoredProgress(user.id)])));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    window.addEventListener("focus", refreshProgressRecords);
    window.addEventListener("pageshow", refreshProgressRecords);
    return () => {
      window.removeEventListener("focus", refreshProgressRecords);
      window.removeEventListener("pageshow", refreshProgressRecords);
    };
  }, [refreshProgressRecords, user]);

  const markLessonWatched = async (lessonId: string) => {
    if (!user) return false;
    const optimisticRecord: VideoProgress = {
      userId: user.id,
      lessonId,
      watched: true,
      watchedAt: new Date().toISOString(),
      watchCount: (progressMap.get(lessonId)?.watchCount ?? 0) + 1,
    };
    saveStoredProgress(optimisticRecord);
    setProgressRecords((records) => {
      const index = records.findIndex((record) => record.userId === user.id && record.lessonId === lessonId);
      return index >= 0 ? records.map((record, recordIndex) => (recordIndex === index ? optimisticRecord : record)) : [...records, optimisticRecord];
    });

    try {
      const res = await fetch("/api/video-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId }),
      });
      if (!res.ok) return false;
      const savedRecord = (await res.json()) as VideoProgress;
      saveStoredProgress(savedRecord);
      setProgressRecords((records) => {
        const index = records.findIndex((record) => record.userId === user.id && record.lessonId === lessonId);
        return index >= 0 ? records.map((record, recordIndex) => (recordIndex === index ? savedRecord : record)) : [...records, savedRecord];
      });
      return true;
    } catch {
      return false;
    }
  };

  const openLesson = async (lessonId: string) => {
    await markLessonWatched(lessonId);
    window.sessionStorage.setItem(`video-progress-marked:${lessonId}`, "1");
    router.push(`/videos/${lessonId}`);
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
        <div className="w-full max-w-md rounded-2xl border border-white/20 bg-white/10 p-8 text-center text-white shadow-[0_24px_80px_rgba(5,12,28,0.26)] backdrop-blur-xl">
          <LogIn className="mx-auto mb-4 h-10 w-10 text-blue-300" />
          <h1 className="mb-3 text-2xl font-black">ログインが必要です</h1>
          <p className="mb-6 text-sm leading-6 text-blue-100">＠will授業を視聴するには、生徒アカウントでログインしてください。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="video-catalog-shell min-h-screen text-white">
      <div className="mx-auto grid w-full max-w-[1800px] gap-4 px-4 py-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="rounded-xl border border-blue-300/18 bg-blue-950/42 p-5 shadow-[0_20px_70px_rgba(0,10,30,0.22)] backdrop-blur-xl">
            <p className="text-sm font-black text-blue-100">生徒基本情報</p>
            <div className="mt-5 flex flex-col items-center text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-400/20 text-blue-100 ring-1 ring-blue-200/20">
                <ShieldCheck className="h-10 w-10" />
              </div>
              <p className="mt-4 text-xl font-black">{user.name}</p>
              <p className="mt-1 text-sm font-bold text-blue-100/70">{courseProfile?.enrollments[0]?.grade ?? "学年未設定"}</p>
            </div>
            <div className="mt-5 space-y-3 rounded-lg border border-white/10 bg-white/6 p-4 text-sm">
              <InfoRow label="志望校" value={formatGoal(courseProfile?.goal ?? null)} />
              <InfoRow label="受講" value={formatEnrollment(courseProfile)} />
            </div>
          </section>

          <section className="rounded-xl border border-blue-300/18 bg-blue-950/42 p-5 shadow-[0_20px_70px_rgba(0,10,30,0.22)] backdrop-blur-xl">
            <p className="text-sm font-black text-blue-100">受講進捗</p>
            <div className="mt-5 flex items-center gap-4">
              <div className="grid h-24 w-24 place-items-center rounded-full bg-white/10 p-3">
                <div className="grid h-full w-full place-items-center rounded-full bg-[#071c3a] ring-8 ring-blue-500/75">
                  <span className="text-3xl font-black">{progressPercent}%</span>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <p className="font-black text-blue-100">視聴済 <span className="ml-2 text-lg text-white">{watchedTotal}</span> 講</p>
                <p className="font-black text-blue-100">全体 <span className="ml-2 text-lg text-white">{visibleAllLessons.length}</span> 講</p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-blue-300/18 bg-blue-950/42 p-5 shadow-[0_20px_70px_rgba(0,10,30,0.22)] backdrop-blur-xl">
            <p className="text-sm font-black text-blue-100">未視聴講座</p>
            <div className="mt-4 space-y-3 rounded-lg border border-white/10 bg-white/6 p-4 text-sm font-black">
              <div className="flex items-center justify-between gap-3">
                <span className="text-blue-100/80">共通テスト対策『レベルアップ講座』</span>
                <span className="text-lg text-white">{commonUnwatched}本</span>
              </div>
              {hasSecondaryLessons && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-blue-100/80">2次対策『大学別特講』</span>
                  <span className="text-lg text-white">{secondaryUnwatched}本</span>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-blue-300/18 bg-blue-950/42 p-5 shadow-[0_20px_70px_rgba(0,10,30,0.22)] backdrop-blur-xl">
            <p className="text-sm font-black text-blue-100">直近の視聴履歴</p>
            <div className="mt-4 overflow-hidden rounded-lg border border-white/10">
              {recentLessons.length === 0 ? (
                <p className="bg-white/5 px-4 py-5 text-sm font-bold text-blue-100/60">まだ視聴履歴がありません。</p>
              ) : (
                recentLessons.map(({ lesson, record }) => {
                  const status = getLessonStatus(record);
                  return (
                    <button key={`${lesson.id}-${record.watchedAt}`} type="button" onClick={() => void openLesson(lesson.id)} className="grid w-full grid-cols-[1fr_82px] gap-3 border-b border-white/10 bg-white/5 px-4 py-3 text-left text-xs last:border-b-0 hover:bg-white/10">
                      <span className="min-w-0">
                        <span className="block truncate font-black text-white">{lesson.title}</span>
                        <span className="mt-1 block truncate font-bold text-blue-100/55">{videoSkillLabels[lesson.skill]} / {formatDate(record.watchedAt)}</span>
                      </span>
                      <span className={`self-center rounded-md px-2 py-1 text-center font-black ring-1 ${statusClass(status)}`}>{getStatusLabel(status)}</span>
                    </button>
                  );
                })
              )}
            </div>
          </section>
        </aside>

        <main className="min-w-0 rounded-xl border border-blue-300/18 bg-blue-950/32 shadow-[0_24px_90px_rgba(0,10,30,0.28)] backdrop-blur-xl">
          <div className="border-b border-white/10 p-6">
            <div className={`grid gap-8 ${mode === "secondary" ? "2xl:grid-cols-[minmax(0,0.86fr)_minmax(620px,1.14fr)] 2xl:items-start" : ""}`}>
              <div>
            <p className="text-xs font-black tracking-[0.24em] text-cyan-300">@WILL LESSONS</p>
            <h1 className="mt-2 text-3xl font-black md:text-4xl">＠will授業</h1>
            <p className="mt-3 text-sm font-bold leading-6 text-blue-100/72">
              まず講座名を選び、その中の映像リストから視聴します。理論編・実践編が分かれる講座は別講座として表示します。
            </p>

              </div>

              {mode === "secondary" && hasTodaiSecondaryCourse && <SecondaryComingSoonBanner />}
            </div>

            <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="inline-grid rounded-lg border border-white/10 bg-white/5 p-1 sm:grid-cols-2">
                {(["common", "secondary"] as VideoMode[])
                  .filter((item) => item === "common" || hasSecondaryLessons)
                  .map((item) => {
                    const tabLabel = lessonModeTabLabel(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => {
                          setMode(item);
                          setSkill("all");
                          setQuery("");
                        }}
                        className={`min-w-[180px] rounded-md px-5 py-2.5 text-center font-black leading-tight transition ${
                          mode === item ? "bg-blue-600 text-white shadow-[0_12px_32px_rgba(37,99,235,0.28)]" : "text-blue-100/75 hover:bg-white/8 hover:text-white"
                        }`}
                      >
                        <span className="block text-xs">{tabLabel.category}</span>
                        <span className="mt-0.5 block text-lg">{tabLabel.title}</span>
                      </button>
                    );
                  })}
              </div>

              <label className="relative block w-full lg:max-w-[360px]">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-100/50" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="講座名・映像名で検索"
                  className="min-h-12 w-full rounded-lg border border-white/12 bg-white/7 py-3 pl-11 pr-4 text-sm font-bold text-white outline-none placeholder:text-blue-100/40 focus:border-blue-300/50"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSkill("all")}
                className={`rounded-full border px-4 py-2 text-xs font-black transition ${
                  skill === "all" ? "border-blue-500 bg-blue-600 text-white" : "border-white/10 bg-white/5 text-blue-100/75 hover:bg-white/10"
                }`}
              >
                すべての科目
              </button>
              {availableFilters.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setSkill(item)}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-black transition ${filterAccentClass(item, skill === item)}`}
                >
                  {majorSkillLabels[item]}
                  <span className={skill === item && item === "japanese" ? "text-slate-900/70" : "text-white/75"}>{skillCounts.get(item) ?? 0}</span>
                </button>
              ))}
            </div>
          </div>

          <section className="p-5">
            {selectedCourse ? (
              <LessonTable course={selectedCourse} mode={mode} progressMap={progressMap} onBack={() => setSelectedCourseKey(null)} onOpen={openLesson} />
            ) : (
              <>
                <CourseGroupList groups={visibleCourseGroups} onSelect={setSelectedCourseKey} />
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm font-bold text-blue-100/70">
                  <span>
                    {courseGroups.length === 0 ? "0" : `${(page - 1) * PAGE_SIZE + 1}-${Math.min(page * PAGE_SIZE, courseGroups.length)}`} / {courseGroups.length}講座
                  </span>
                  <div className="flex items-center gap-2">
                    <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-md border border-white/10 bg-white/5 px-3 py-2 disabled:opacity-40">
                      前へ
                    </button>
                    <span className="rounded-md border border-blue-300/20 bg-blue-600/30 px-3 py-2 text-white">{page}</span>
                    <button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} className="rounded-md border border-white/10 bg-white/5 px-3 py-2 disabled:opacity-40">
                      次へ
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[64px_1fr] gap-3">
      <span className="font-black text-blue-100/65">{label}</span>
      <span className="font-black text-white">{value}</span>
    </div>
  );
}

function SecondaryComingSoonBanner() {
  return (
    <aside className="secondary-levelup-banner" aria-label="安部先生の新規講座予告">
      <div className="secondary-levelup-banner__content">
        <p className="secondary-levelup-banner__ribbon">COMING SOON</p>
        <p className="secondary-levelup-banner__headline">
          安部大世先生の「東大２次対策」
          <span>新規講座、作成中！</span>
        </p>
        <p className="secondary-levelup-banner__sub">まもなくリリース！こうご期待！</p>
      </div>
    </aside>
  );
}

function CourseGroupList({ groups, onSelect }: { groups: CourseGroup[]; onSelect: (key: string) => void }) {
  if (groups.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-8 text-center">
        <p className="text-lg font-black text-white">表示できる講座がありません</p>
        <p className="mt-2 text-sm font-bold text-blue-100/60">検索条件や科目フィルターを変更してください。</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {groups.map((group) => {
        const progressPercent = Math.round((group.watchedCount / group.lessons.length) * 100);
        const accent = lessonAccent(group.skill, group.accentCategory);
        return (
          <button
            key={group.key}
            type="button"
            onClick={() => onSelect(group.key)}
            className={`grid gap-3 rounded-xl border border-l-4 border-white/10 ${accent.line} ${accent.surface} p-4 text-left transition lg:grid-cols-[minmax(0,1fr)_180px] ${accent.row}`}
          >
            <span className="min-w-0">
              <span className="mb-2 flex flex-wrap items-center gap-2 text-xs font-black text-blue-100/70">
                <span className={`rounded-md px-2.5 py-1 ring-1 ${accent.chip}`}>{group.modeLabel}</span>
                <span className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 ring-1 ${accent.chip}`}>
                  {skillIcon(group.skill)}
                  {videoSkillLabels[group.skill]}
                </span>
              </span>
              <span className="block text-lg font-black text-white">{group.title}</span>
              <span className="mt-1 block text-sm font-bold text-blue-100/55">{group.teacher || "担当未設定"}</span>
            </span>
            <span className="self-center text-sm font-black text-blue-100/75">
              <span className="block text-right text-white">{group.lessons.length}本</span>
              <span className="mt-2 block h-2 overflow-hidden rounded-full bg-white/10">
                <span className={`block h-full rounded-full ${progressFillClass(progressPercent, accent)}`} style={{ width: `${progressPercent}%` }} />
              </span>
              <span className="mt-1 block text-right">{group.watchedCount}/{group.lessons.length} 視聴</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function LessonTable({
  course,
  mode,
  progressMap,
  onBack,
  onOpen,
}: {
  course: CourseGroup;
  mode: VideoMode;
  progressMap: Map<string, VideoProgress>;
  onBack: () => void;
  onOpen: (lessonId: string) => Promise<void>;
}) {
  const accent = lessonAccent(course.skill, course.accentCategory);
  const materialReturnTo = `/videos?mode=${encodeURIComponent(mode)}&courseKey=${encodeURIComponent(course.key)}`;
  const materialUrl = course.materialPdfUrl
    ? `/videos/material?title=${encodeURIComponent(course.title)}&pdf=${encodeURIComponent(course.materialPdfUrl)}&returnTo=${encodeURIComponent(materialReturnTo)}`
    : "";
  return (
    <div>
      <div className={`mb-4 flex flex-col gap-3 rounded-xl border border-l-4 border-white/10 ${accent.line} ${accent.surface} p-4 lg:flex-row lg:items-center lg:justify-between`}>
        <div>
          <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/6 px-3 py-2 text-sm font-black text-blue-100 hover:bg-white/10">
            <ArrowLeft className="h-4 w-4" />
            講座一覧へ戻る
          </button>
          <p className="text-2xl font-black text-white">{course.title}</p>
          <p className="mt-1 text-sm font-bold text-blue-100/55">{course.teacher || "担当未設定"} / {course.lessons.length}本</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {materialUrl ? (
            <Link
              href={materialUrl}
              className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-200/35 bg-cyan-400/12 px-4 py-2 text-sm font-black text-cyan-50 shadow-[0_0_24px_rgba(34,211,238,0.14)] ring-1 ring-cyan-300/20 transition hover:bg-cyan-400 hover:text-slate-950"
            >
              <FileText className="h-4 w-4" />
              教材PDF
            </Link>
          ) : null}
          <span className={`inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-black ring-1 ${accent.chip}`}>
            {skillIcon(course.skill)}
            {videoSkillLabels[course.skill]}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-white/10 bg-white/5">
        <table className="w-full min-w-[820px] border-collapse text-left">
          <thead className="bg-white/6 text-xs font-black text-blue-100/70">
            <tr>
              <th className="w-20 px-4 py-3">順番</th>
              <th className="px-4 py-3">映像名</th>
              <th className="px-4 py-3">小単元</th>
              <th className="px-4 py-3">視聴状況</th>
              <th className="px-4 py-3">最終視聴日</th>
              <th className="px-4 py-3 text-right">アクション</th>
            </tr>
          </thead>
          <tbody>
            {course.lessons.map((lesson, index) => {
              const progress = progressMap.get(lesson.id);
              const status = getLessonStatus(progress);
              return (
                <tr key={lesson.id} className={`border-t border-white/10 text-sm transition odd:bg-white/[0.025] ${accent.row}`}>
                  <td className="px-4 py-3 font-black text-blue-100/75">{index + 1}</td>
                  <td className="max-w-[380px] px-4 py-3">
                    <p className="truncate font-black text-white">{lesson.title}</p>
                    <p className="mt-1 truncate text-xs font-bold text-blue-100/48">{lesson.courseName}</p>
                  </td>
                  <td className="max-w-[260px] px-4 py-3 font-bold text-blue-100/68">
                    <span className="block truncate">{lesson.chapter || lesson.sectionTitle || "-"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-md px-3 py-1.5 text-xs font-black ring-1 ${statusClass(status)}`}>{getStatusLabel(status)}</span>
                  </td>
                  <td className="px-4 py-3 font-bold text-blue-100/68">{formatDate(progress?.watchedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {lesson.hasQuiz && (
                        <Link
                          href={`/videos/${lesson.id}/quiz`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-200/45 bg-emerald-500/16 text-emerald-50 transition hover:bg-emerald-500 hover:text-white"
                          aria-label={`${lesson.title}の確認問題`}
                        >
                          <ClipboardCheck className="h-5 w-5" />
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={() => void onOpen(lesson.id)}
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition ${accent.button}`}
                        aria-label={`${lesson.title}を再生`}
                      >
                        <PlayCircle className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
