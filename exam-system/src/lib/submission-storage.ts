import fs from "fs";
import path from "path";
import { neon } from "@neondatabase/serverless";
import { get, list, put } from "@vercel/blob";

export type StoredSubmission = {
  id: string;
  examId: string;
  studentId: string;
  content: string;
  images?: string[];
  timestamp: string;
  status: string;
  score?: number;
  maxScore?: number;
  feedback?: string;
  gradedAt?: string;
  importedAt?: string;
};

type StoredGrade = {
  examId: string;
  submissionId: string;
  score: number;
  maxScore: number;
  feedback?: string;
  gradedAt?: string;
  sections?: unknown[];
};

const SUBMISSION_ROOT = "submissions";
const LOCAL_SUBMISSION_CACHE_TTL_MS = 5000;
const SEED_SUBMISSIONS_FILE = path.resolve(process.cwd(), "..", "data", "seed-submissions.json");
let schemaReady = false;
let localSubmissionCache:
  | {
      expiresAt: number;
      submissions: StoredSubmission[];
    }
  | null = null;

function dataRoot() {
  if (process.env.VERCEL) return path.join("/tmp", "exam-system-local-data");
  return path.join(process.cwd(), "local-data");
}

function toPosixPath(...parts: string[]) {
  return parts
    .flatMap((part) => part.split(/[\\/]+/))
    .filter(Boolean)
    .join("/");
}

function toFsPath(...parts: string[]) {
  return path.join(dataRoot(), ...parts);
}

function blobEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
}

function dbEnabled() {
  return Boolean(databaseUrl());
}

function sqlClient() {
  return neon(databaseUrl());
}

function invalidateLocalSubmissionCache() {
  localSubmissionCache = null;
}

function readSeedSubmissions() {
  if (!fs.existsSync(SEED_SUBMISSIONS_FILE)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(SEED_SUBMISSIONS_FILE, "utf-8"));
    if (!Array.isArray(parsed)) return [];
    return parsed as StoredSubmission[];
  } catch (error) {
    console.error("Failed to read seed submissions.", error);
    return [];
  }
}

function sortSubmissions(submissions: StoredSubmission[]) {
  return submissions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

function mergeSeedSubmissions(submissions: StoredSubmission[]) {
  const merged = new Map<string, StoredSubmission>();
  readSeedSubmissions().forEach((submission) => merged.set(submission.id, submission));
  submissions.forEach((submission) => merged.set(submission.id, submission));
  return sortSubmissions([...merged.values()]);
}

function submissionPrefix(examId?: string, submissionId?: string) {
  return toPosixPath(SUBMISSION_ROOT, examId ?? "", submissionId ?? "");
}

function submissionFilePath(examId: string, submissionId: string, fileName: string) {
  return toPosixPath(SUBMISSION_ROOT, examId, submissionId, fileName);
}

async function readBlobText(pathname: string) {
  const result = await get(pathname, { access: "private" });
  if (!result || result.statusCode !== 200) return null;
  return await new Response(result.stream).text();
}

async function readBlobBuffer(pathname: string) {
  const result = await get(pathname, { access: "private" });
  if (!result || result.statusCode !== 200) return null;
  const arrayBuffer = await new Response(result.stream).arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function listAllBlobPathnames(prefix: string) {
  const pathnames: string[] = [];
  let cursor: string | undefined;

  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    pathnames.push(...page.blobs.map((blob) => blob.pathname));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  return pathnames;
}

async function ensureSubmissionSchema() {
  if (schemaReady || !dbEnabled()) return;

  const sql = sqlClient();
  await sql`
    CREATE TABLE IF NOT EXISTS submission_files (
      pathname TEXT PRIMARY KEY,
      content_base64 TEXT NOT NULL,
      content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  schemaReady = true;
}

async function writeDbFile(pathname: string, content: Buffer | string, contentType: string) {
  await ensureSubmissionSchema();
  const sql = sqlClient();
  const buffer = typeof content === "string" ? Buffer.from(content, "utf-8") : content;
  await sql`
    INSERT INTO submission_files (pathname, content_base64, content_type, updated_at)
    VALUES (${pathname}, ${buffer.toString("base64")}, ${contentType}, NOW())
    ON CONFLICT (pathname) DO UPDATE SET
      content_base64 = EXCLUDED.content_base64,
      content_type = EXCLUDED.content_type,
      updated_at = NOW()
  `;
}

async function readDbBuffer(pathname: string) {
  await ensureSubmissionSchema();
  const sql = sqlClient();
  const rows = await sql`
    SELECT content_base64
    FROM submission_files
    WHERE pathname = ${pathname}
    LIMIT 1
  `;
  const content = rows[0]?.content_base64;
  return typeof content === "string" ? Buffer.from(content, "base64") : null;
}

async function readDbText(pathname: string) {
  const buffer = await readDbBuffer(pathname);
  return buffer ? buffer.toString("utf-8") : null;
}

async function listAllDbPathnames(prefix: string) {
  await ensureSubmissionSchema();
  const sql = sqlClient();
  const rows = await sql`
    SELECT pathname
    FROM submission_files
    WHERE pathname LIKE ${`${prefix}%`}
    ORDER BY pathname
  `;
  return rows.map((row) => String(row.pathname));
}

export async function writeSubmissionText(
  examId: string,
  submissionId: string,
  fileName: string,
  content: string,
  contentType: string,
) {
  const relativePath = submissionFilePath(examId, submissionId, fileName);
  if (blobEnabled()) {
    await put(relativePath, content, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType,
    });
    return;
  }

  if (dbEnabled()) {
    try {
      await writeDbFile(relativePath, content, contentType);
      invalidateLocalSubmissionCache();
      return;
    } catch (error) {
      if (!process.env.VERCEL) throw error;
      console.error("Database submission write failed; falling back to local storage.", error);
    }
  }

  const targetDir = toFsPath(SUBMISSION_ROOT, examId, submissionId);
  fs.mkdirSync(targetDir, { recursive: true });
  const filePath = path.join(targetDir, fileName);
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, content, "utf-8");
  fs.renameSync(tempPath, filePath);
  invalidateLocalSubmissionCache();
}

export async function writeSubmissionBuffer(
  examId: string,
  submissionId: string,
  fileName: string,
  content: Buffer,
  contentType: string,
) {
  const relativePath = submissionFilePath(examId, submissionId, fileName);
  if (blobEnabled()) {
    await put(relativePath, content, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType,
    });
    return;
  }

  if (dbEnabled()) {
    try {
      await writeDbFile(relativePath, content, contentType);
      invalidateLocalSubmissionCache();
      return;
    } catch (error) {
      if (!process.env.VERCEL) throw error;
      console.error("Database submission write failed; falling back to local storage.", error);
    }
  }

  const targetDir = toFsPath(SUBMISSION_ROOT, examId, submissionId);
  fs.mkdirSync(targetDir, { recursive: true });
  const filePath = path.join(targetDir, fileName);
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, content);
  fs.renameSync(tempPath, filePath);
  invalidateLocalSubmissionCache();
}

export async function readSubmissionText(relativePath: string) {
  if (blobEnabled() && relativePath.startsWith(`${SUBMISSION_ROOT}/`)) {
    return await readBlobText(relativePath);
  }

  if (dbEnabled() && relativePath.startsWith(`${SUBMISSION_ROOT}/`)) {
    try {
      return await readDbText(relativePath);
    } catch (error) {
      if (!process.env.VERCEL) throw error;
      console.error("Database submission read failed; falling back to local storage.", error);
    }
  }

  const filePath = toFsPath(...relativePath.split("/"));
  if (!filePath.startsWith(dataRoot())) return null;
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, "utf-8");
}

export async function readSubmissionBuffer(relativePath: string) {
  if (blobEnabled() && relativePath.startsWith(`${SUBMISSION_ROOT}/`)) {
    return await readBlobBuffer(relativePath);
  }

  if (dbEnabled() && relativePath.startsWith(`${SUBMISSION_ROOT}/`)) {
    try {
      return await readDbBuffer(relativePath);
    } catch (error) {
      if (!process.env.VERCEL) throw error;
      console.error("Database submission read failed; falling back to local storage.", error);
    }
  }

  const filePath = toFsPath(...relativePath.split("/"));
  if (!filePath.startsWith(dataRoot())) return null;
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath);
}

export async function submissionExists(examId: string, submissionId: string) {
  const submissionPath = submissionFilePath(examId, submissionId, "submission.json");
  if (blobEnabled()) {
    const text = await readBlobText(submissionPath);
    return text !== null;
  }

  if (dbEnabled()) {
    try {
      const text = await readDbText(submissionPath);
      return text !== null;
    } catch (error) {
      if (!process.env.VERCEL) throw error;
      console.error("Database submission exists check failed; falling back to local storage.", error);
    }
  }

  return fs.existsSync(toFsPath(SUBMISSION_ROOT, examId, submissionId, "submission.json"));
}

export async function listStoredSubmissions(): Promise<StoredSubmission[]> {
  if (blobEnabled() || dbEnabled()) {
    let allPathnames: string[] | null = null;
    if (blobEnabled()) {
      allPathnames = await listAllBlobPathnames(`${SUBMISSION_ROOT}/`);
    } else {
      try {
        allPathnames = await listAllDbPathnames(`${SUBMISSION_ROOT}/`);
      } catch (error) {
        if (!process.env.VERCEL) throw error;
        console.error("Database submission list failed; falling back to local storage.", error);
      }
    }

    if (allPathnames) {
      const submissionJsons = allPathnames.filter((pathname) => pathname.endsWith("/submission.json"));
      const gradeJsons = new Set(allPathnames.filter((pathname) => pathname.endsWith("/grade.json")));

      const submissions = await Promise.all(
        submissionJsons.map(async (pathname) => {
          const submissionText = blobEnabled() ? await readBlobText(pathname) : await readDbText(pathname);
          if (!submissionText) return null;
          const submission = JSON.parse(submissionText) as StoredSubmission;
          const gradePath = pathname.replace(/submission\.json$/, "grade.json");
          if (gradeJsons.has(gradePath)) {
            const gradeText = blobEnabled() ? await readBlobText(gradePath) : await readDbText(gradePath);
            if (gradeText) {
              const grade = JSON.parse(gradeText) as StoredGrade;
              submission.score = grade.score;
              submission.maxScore = grade.maxScore;
              submission.feedback = grade.feedback;
              submission.gradedAt = grade.gradedAt;
              submission.status = "graded";
            }
          }
          return submission;
        }),
      );

      return mergeSeedSubmissions(submissions.filter((item): item is StoredSubmission => Boolean(item)));
    }
  }

  const submissionsDir = toFsPath(SUBMISSION_ROOT);
  if (!fs.existsSync(submissionsDir)) return mergeSeedSubmissions([]);

  if (localSubmissionCache && localSubmissionCache.expiresAt > Date.now()) {
    return localSubmissionCache.submissions;
  }

  const collected: StoredSubmission[] = [];
  const visit = (dir: string) => {
    for (const entry of fs.readdirSync(dir)) {
      const entryPath = path.join(dir, entry);
      if (fs.statSync(entryPath).isDirectory()) {
        visit(entryPath);
        continue;
      }

      if (entry !== "submission.json") continue;

      const submission = JSON.parse(fs.readFileSync(entryPath, "utf-8")) as StoredSubmission;
      const gradePath = path.join(path.dirname(entryPath), "grade.json");
      if (fs.existsSync(gradePath)) {
        const grade = JSON.parse(fs.readFileSync(gradePath, "utf-8")) as StoredGrade;
        submission.score = grade.score;
        submission.maxScore = grade.maxScore;
        submission.feedback = grade.feedback;
        submission.gradedAt = grade.gradedAt;
        submission.status = "graded";
      }
      collected.push(submission);
    }
  };

  visit(submissionsDir);
  const submissions = mergeSeedSubmissions(collected);
  localSubmissionCache = {
    expiresAt: Date.now() + LOCAL_SUBMISSION_CACHE_TTL_MS,
    submissions,
  };
  return submissions;
}

export function buildSubmissionStoragePath(...parts: string[]) {
  return toPosixPath(...parts);
}

export function isSubmissionStoragePath(relativePath: string) {
  return relativePath.startsWith(`${SUBMISSION_ROOT}/`);
}

export function createSubmissionId(studentId: string) {
  return `${studentId}-${Date.now()}`;
}

export function getSubmissionImagePath(examId: string, submissionId: string, fileName: string) {
  return submissionFilePath(examId, submissionId, fileName);
}

export function getSubmissionJsonPath(examId: string, submissionId: string) {
  return submissionFilePath(examId, submissionId, "submission.json");
}

export function getGradeJsonPath(examId: string, submissionId: string) {
  return submissionFilePath(examId, submissionId, "grade.json");
}
