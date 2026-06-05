import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { getSessionUser } from "@/lib/session";
import { readSubmissionBuffer, readSubmissionText } from "@/lib/submission-storage";

const DATA_ROOT_NAMES = new Set([
  "common",
  "common_retake",
  "todai",
  "kyodai",
  "nagoya",
  "hamamatsu_medical",
  "secondary",
]);

function getContentType(filePath: string) {
  if (filePath.endsWith(".md")) return "text/markdown";
  if (filePath.endsWith(".json")) return "application/json";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  if (filePath.endsWith(".webp")) return "image/webp";
  if (filePath.endsWith(".gif")) return "image/gif";
  return "application/octet-stream";
}

function toStoragePath(...parts: string[]) {
  return parts
    .flatMap((part) => part.split(/[\\/]+/))
    .filter(Boolean)
    .join("/");
}

async function readSubmissionBlob(relativePath: string) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;

  const result = await get(relativePath, { access: "private" });
  if (!result || result.statusCode !== 200) return null;

  const arrayBuffer = await new Response(result.stream).arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function GET(
  request: Request,
  props: { params: Promise<{ path: string[] }> },
) {
  const params = await props.params;

  try {
    const relativePath = toStoragePath(...params.path);

    if (relativePath.startsWith("submissions/")) {
      const sessionUser = await getSessionUser();
      if (!sessionUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      if (sessionUser.role !== "teacher") {
        const submissionText = await readSubmissionText(relativePath.replace(/\/[^/]+$/, "/submission.json"));
        if (!submissionText) {
          return NextResponse.json({ error: "File not found" }, { status: 404 });
        }
        const submission = JSON.parse(submissionText) as { studentId?: string };
        if (submission.studentId !== sessionUser.id) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }

      const fileBuffer =
        (await readSubmissionBlob(relativePath)) ?? (await readSubmissionBuffer(relativePath));
      if (!fileBuffer) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }

      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": getContentType(relativePath),
          "Content-Length": fileBuffer.byteLength.toString(),
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
    }

    const [rootName, ...restPath] = params.path;
    if (!rootName || !DATA_ROOT_NAMES.has(rootName)) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
    }

    if (restPath.some((part) => part === ".." || part.includes("/") || part.includes("\\"))) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
    }

    return NextResponse.redirect(new URL(`/exam-assets/${[rootName, ...restPath].join("/")}`, request.url));
  } catch (error) {
    console.error("Error serving file:", error);
    return NextResponse.json({ error: "Failed to serve file" }, { status: 500 });
  }
}
