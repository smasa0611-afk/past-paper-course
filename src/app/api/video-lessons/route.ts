import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { videoSkillOrder } from "@/lib/video-labels";
import { getSubscribedSecondaryTargetsAsync } from "@/lib/secondary-access";
import { getSessionUser } from "@/lib/session";
import type { VideoLesson, VideoLessonListItem } from "@/types/video";
import type { SecondaryTargetKey } from "@/types/secondary";

function videoLessonsPath() {
  return path.resolve(process.cwd(), "data", "video-lessons.json");
}

function readLessons(): VideoLesson[] {
  const filePath = videoLessonsPath();
  return fs.existsSync(filePath)
    ? (JSON.parse(fs.readFileSync(filePath, "utf-8")) as VideoLesson[])
    : [];
}

function materialPdfPathForCourse(courseName: string) {
  let hash = 0;
  for (let i = 0; i < courseName.length; i += 1) {
    hash = (hash * 31 + courseName.charCodeAt(i)) >>> 0;
  }
  return `/materials/dummy-levelup-text-${hash.toString(36)}.pdf`;
}

function withMaterialPdf(lesson: VideoLesson): VideoLesson {
  if (lesson.materialPdfUrl) return lesson;
  return { ...lesson, materialPdfUrl: materialPdfPathForCourse(lesson.courseName) };
}

function toListItem(lesson: VideoLesson): VideoLessonListItem {
  const { videoId: _videoId, videoUrl: _videoUrl, ...safeLesson } = lesson;
  return safeLesson;
}

async function filterLessonsByAccess(lessons: VideoLesson[], user: { id: string; role: "student" | "teacher" }) {
  if (user.role === "teacher") return lessons;
  const subscribedTargets = await getSubscribedSecondaryTargetsAsync(user.id);

  return lessons.filter((lesson) => {
    if (lesson.subject !== "secondary") return true;
    return Boolean(lesson.examType && subscribedTargets.has(lesson.examType as SecondaryTargetKey));
  });
}

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const skill = searchParams.get("skill");
  const lessons = (await filterLessonsByAccess(readLessons().map(withMaterialPdf), user)).sort((a, b) => {
    const skillDiff = videoSkillOrder.indexOf(a.skill) - videoSkillOrder.indexOf(b.skill);
    if (skillDiff !== 0) return skillDiff;
    return a.sequence - b.sequence;
  });

  if (id) {
    const lesson = lessons.find((item) => item.id === id);
    if (!lesson) {
      return NextResponse.json({ error: "Video lesson not found." }, { status: 404 });
    }
    return NextResponse.json(lesson);
  }

  const filtered = skill && skill !== "all" ? lessons.filter((item) => item.skill === skill) : lessons;
  return NextResponse.json(filtered.map(toListItem));
}
