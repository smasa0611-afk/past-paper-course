import fs from "fs";
import path from "path";
import { neon } from "@neondatabase/serverless";
import { get, put } from "@vercel/blob";
import { readJsonFile, writeJsonFileAtomic } from "@/lib/json-file-store";

export type Assignment = {
  id: string;
  studentId: string;
  examId: string;
  dueDate: string;
  score?: number;
  maxScore?: number;
  submittedAt?: string;
  gradedAt?: string;
  importedAt?: string;
};

const BLOB_ASSIGNMENTS_PATH = "data/assignments.json";
let schemaReady = false;

function bundledAssignmentsPath() {
  return path.resolve(process.cwd(), "data", "assignments.json");
}

function writableAssignmentsPath() {
  if (process.env.VERCEL) return path.join("/tmp", "assignments.json");
  return bundledAssignmentsPath();
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

function readLocalAssignments() {
  const writablePath = writableAssignmentsPath();
  if (process.env.VERCEL && fs.existsSync(writablePath)) {
    return readJsonFile<Assignment[]>(writablePath, []);
  }

  return readJsonFile<Assignment[]>(bundledAssignmentsPath(), []);
}

async function ensureAssignmentSchema() {
  if (schemaReady || !dbEnabled()) return;

  const sql = sqlClient();
  await sql`
    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      exam_id TEXT NOT NULL,
      due_date TEXT NOT NULL,
      score DOUBLE PRECISION,
      max_score DOUBLE PRECISION,
      submitted_at TEXT,
      graded_at TEXT,
      imported_at TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(student_id, exam_id)
    )
  `;
  await sql`ALTER TABLE assignments ADD COLUMN IF NOT EXISTS score DOUBLE PRECISION`;
  await sql`ALTER TABLE assignments ADD COLUMN IF NOT EXISTS max_score DOUBLE PRECISION`;
  await sql`ALTER TABLE assignments ADD COLUMN IF NOT EXISTS submitted_at TEXT`;
  await sql`ALTER TABLE assignments ADD COLUMN IF NOT EXISTS graded_at TEXT`;
  await sql`ALTER TABLE assignments ADD COLUMN IF NOT EXISTS imported_at TEXT`;
  schemaReady = true;
}

async function readDbAssignments() {
  await ensureAssignmentSchema();
  const sql = sqlClient();
  const rows = await sql`
    SELECT id, student_id, exam_id, due_date, score, max_score, submitted_at, graded_at, imported_at
    FROM assignments
    ORDER BY due_date, student_id, exam_id
  `;

  return rows.map((row) => ({
    id: String(row.id),
    studentId: String(row.student_id),
    examId: String(row.exam_id),
    dueDate: String(row.due_date),
    score: row.score === null || row.score === undefined ? undefined : Number(row.score),
    maxScore: row.max_score === null || row.max_score === undefined ? undefined : Number(row.max_score),
    submittedAt: row.submitted_at ? String(row.submitted_at) : undefined,
    gradedAt: row.graded_at ? String(row.graded_at) : undefined,
    importedAt: row.imported_at ? String(row.imported_at) : undefined,
  })) satisfies Assignment[];
}

async function writeDbAssignments(assignments: Assignment[]) {
  await ensureAssignmentSchema();
  const sql = sqlClient();

  await sql`DELETE FROM assignments`;
  for (const assignment of assignments) {
    await sql`
      INSERT INTO assignments (id, student_id, exam_id, due_date, score, max_score, submitted_at, graded_at, imported_at, updated_at)
      VALUES (
        ${assignment.id},
        ${assignment.studentId},
        ${assignment.examId},
        ${assignment.dueDate},
        ${assignment.score ?? null},
        ${assignment.maxScore ?? null},
        ${assignment.submittedAt ?? null},
        ${assignment.gradedAt ?? null},
        ${assignment.importedAt ?? null},
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        student_id = EXCLUDED.student_id,
        exam_id = EXCLUDED.exam_id,
        due_date = EXCLUDED.due_date,
        score = EXCLUDED.score,
        max_score = EXCLUDED.max_score,
        submitted_at = EXCLUDED.submitted_at,
        graded_at = EXCLUDED.graded_at,
        imported_at = EXCLUDED.imported_at,
        updated_at = NOW()
    `;
  }
}

async function readBlobAssignments() {
  try {
    const result = await get(BLOB_ASSIGNMENTS_PATH, { access: "private" });
    if (!result || result.statusCode !== 200) return null;
    const text = await new Response(result.stream).text();
    return JSON.parse(text) as Assignment[];
  } catch {
    return null;
  }
}

export async function readAssignments() {
  if (dbEnabled()) {
    try {
      const dbAssignments = await readDbAssignments();
      if (dbAssignments.length > 0) return dbAssignments;
      return readLocalAssignments();
    } catch (error) {
      console.error("Database assignment read failed; falling back to file storage.", error);
    }
  }

  if (blobEnabled()) {
    const blobAssignments = await readBlobAssignments();
    if (blobAssignments) return blobAssignments;
  }

  return readLocalAssignments();
}

export async function writeAssignments(assignments: Assignment[]) {
  if (dbEnabled()) {
    try {
      await writeDbAssignments(assignments);
      return;
    } catch (error) {
      console.error("Database assignment write failed; falling back to file storage.", error);
    }
  }

  if (blobEnabled()) {
    try {
      await put(BLOB_ASSIGNMENTS_PATH, JSON.stringify(assignments, null, 2), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json; charset=utf-8",
      });
      return;
    } catch (error) {
      if (!process.env.VERCEL) throw error;
      console.error("Blob assignment write failed; falling back to local storage.", error);
    }
  }

  writeJsonFileAtomic(writableAssignmentsPath(), assignments);
}
