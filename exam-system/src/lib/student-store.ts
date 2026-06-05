import fs from "fs";
import path from "path";
import { neon } from "@neondatabase/serverless";
import { get, put } from "@vercel/blob";
import { readJsonFile, writeJsonFileAtomic } from "@/lib/json-file-store";

export type StudentRecord = {
  id: string;
  name?: string;
  nickname?: string;
  email?: string;
  password?: string;
  initialPassword?: string;
  target?: string;
  campus?: string;
  grade?: string;
};

const BLOB_STUDENTS_PATH = "data/students.json";
let schemaReady = false;

function bundledStudentsPath() {
  return path.resolve(process.cwd(), "..", "data", "students.json");
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

function bundledStudents() {
  return readJsonFile<StudentRecord[]>(bundledStudentsPath(), []);
}

async function ensureStudentSchema() {
  if (schemaReady || !dbEnabled()) return;

  const sql = sqlClient();
  await sql`
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      name TEXT,
      nickname TEXT,
      email TEXT,
      password TEXT,
      initial_password TEXT,
      target TEXT,
      campus TEXT,
      grade TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS email TEXT`;
  await sql`ALTER TABLE students ADD COLUMN IF NOT EXISTS initial_password TEXT`;
  schemaReady = true;
}

async function readDbStudents() {
  await ensureStudentSchema();
  const sql = sqlClient();
  const rows = await sql`
    SELECT id, name, nickname, email, password, initial_password, target, campus, grade
    FROM students
    ORDER BY id
  `;

  return rows.map((row) => ({
    id: String(row.id),
    name: row.name ? String(row.name) : "",
    nickname: row.nickname ? String(row.nickname) : "",
    email: row.email ? String(row.email) : "",
    password: row.password ? String(row.password) : "",
    initialPassword: row.initial_password ? String(row.initial_password) : "",
    target: row.target ? String(row.target) : "",
    campus: row.campus ? String(row.campus) : "",
    grade: row.grade ? String(row.grade) : "",
  })) satisfies StudentRecord[];
}

async function writeDbStudents(students: StudentRecord[]) {
  await ensureStudentSchema();
  const sql = sqlClient();

  for (const student of students) {
    await sql`
      INSERT INTO students (id, name, nickname, email, password, initial_password, target, campus, grade, updated_at)
      VALUES (
        ${student.id},
        ${student.name ?? ""},
        ${student.nickname ?? ""},
        ${student.email ?? ""},
        ${student.password ?? ""},
        ${student.initialPassword ?? ""},
        ${student.target ?? ""},
        ${student.campus ?? ""},
        ${student.grade ?? ""},
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        nickname = EXCLUDED.nickname,
        email = EXCLUDED.email,
        password = EXCLUDED.password,
        initial_password = EXCLUDED.initial_password,
        target = EXCLUDED.target,
        campus = EXCLUDED.campus,
        grade = EXCLUDED.grade,
        updated_at = NOW()
    `;
  }
}

async function readBlobStudents() {
  try {
    const result = await get(BLOB_STUDENTS_PATH, { access: "private" });
    if (!result || result.statusCode !== 200) return null;
    const text = await new Response(result.stream).text();
    return JSON.parse(text) as StudentRecord[];
  } catch {
    return null;
  }
}

export async function readStudents() {
  if (dbEnabled()) {
    const dbStudents = await readDbStudents();
    if (dbStudents.length > 0) return dbStudents;
    return bundledStudents();
  }

  if (blobEnabled()) {
    const blobStudents = await readBlobStudents();
    if (blobStudents) return blobStudents;
  }

  return bundledStudents();
}

export async function writeStudents(students: StudentRecord[]) {
  if (dbEnabled()) {
    await writeDbStudents(students);
    return;
  }

  if (blobEnabled()) {
    await put(BLOB_STUDENTS_PATH, JSON.stringify(students, null, 2), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json; charset=utf-8",
    });
    return;
  }

  writeJsonFileAtomic(bundledStudentsPath(), students);
}

export function studentsFileExists() {
  return fs.existsSync(bundledStudentsPath());
}
