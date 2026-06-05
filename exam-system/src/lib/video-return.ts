import type { VideoLesson, VideoLessonListItem } from "@/types/video";

type ReturnableVideoLesson = Pick<VideoLesson | VideoLessonListItem, "courseName" | "examType" | "skill" | "subject" | "title">;

export function getSecondaryCourseTitle(lesson: ReturnableVideoLesson) {
  return lesson.courseName === "大学別対策映像" ? lesson.title : lesson.courseName;
}

export function getSecondaryCourseAnchor(lesson: ReturnableVideoLesson) {
  const raw = `${lesson.examType ?? lesson.skill}:${getSecondaryCourseTitle(lesson)}`;
  let hash = 0;

  for (let index = 0; index < raw.length; index += 1) {
    hash = (hash * 31 + raw.charCodeAt(index)) >>> 0;
  }

  return `secondary-course-${hash.toString(36)}`;
}

export function getVideoReturnPath(lesson: ReturnableVideoLesson | null) {
  if (!lesson || lesson.subject !== "secondary") return "/videos";
  return `/videos?mode=secondary#${getSecondaryCourseAnchor(lesson)}`;
}
