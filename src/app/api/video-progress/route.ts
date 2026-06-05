import { NextResponse } from "next/server";
import path from "path";
import type { VideoProgress } from "@/types/video";
import { readJsonFile, writeJsonFileAtomic } from "@/lib/json-file-store";
import { getSessionUser } from "@/lib/session";

type ProgressBody = {
  lessonId?: string;
};

function progressPath() {
  return path.resolve(process.cwd(), "data", "video-progress.json");
}

function readProgress(): VideoProgress[] {
  return readJsonFile<VideoProgress[]>(progressPath(), []);
}

function writeProgress(records: VideoProgress[]) {
  writeJsonFileAtomic(progressPath(), records);
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  return NextResponse.json(readProgress().filter((record) => record.userId === user.id), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  }

  const body = (await req.json()) as ProgressBody;
  const lessonId = body.lessonId?.trim();
  if (!lessonId) {
    return NextResponse.json({ error: "lessonId は必須です。" }, { status: 400 });
  }

  const records = readProgress();
  const now = new Date().toISOString();
  const index = records.findIndex((record) => record.userId === user.id && record.lessonId === lessonId);

  if (index >= 0) {
    records[index] = {
      ...records[index],
      watched: true,
      watchedAt: now,
      watchCount: (records[index].watchCount ?? 0) + 1,
    };
  } else {
    records.push({
      userId: user.id,
      lessonId,
      watched: true,
      watchedAt: now,
      watchCount: 1,
    });
  }

  writeProgress(records);
  return NextResponse.json(records.find((record) => record.userId === user.id && record.lessonId === lessonId), {
    headers: { "Cache-Control": "no-store" },
  });
}
