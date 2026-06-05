import fs from "fs";
import path from "path";
import { neon } from "@neondatabase/serverless";
import { get, put } from "@vercel/blob";
import { readJsonFile, writeJsonFileAtomic } from "@/lib/json-file-store";

export type TeacherRecord = {
  id: string;
  name: string;
  password?: string;
  initialPassword?: string;
  employeeId?: string;
  isSystemAdmin?: boolean;
  role?: string;
};

const BLOB_TEACHERS_PATH = "data/teachers.json";
let schemaReady = false;

function bundledTeachersPath() {
  return path.resolve(process.cwd(), "data", "teachers.json");
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

function bundledTeachers() {
  return readJsonFile<TeacherRecord[]>(bundledTeachersPath(), []);
}

async function ensureTeacherSchema() {
  if (schemaReady || !dbEnabled()) return;

  const sql = sqlClient();
  await sql`
    CREATE TABLE IF NOT EXISTS teachers (
      id TEXT PRIMARY KEY,
      name TEXT,
      password TEXT,
      initial_password TEXT,
      employee_id TEXT,
      is_system_admin BOOLEAN NOT NULL DEFAULT FALSE,
      role TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS initial_password TEXT`;
  await sql`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS employee_id TEXT`;
  await sql`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS is_system_admin BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS role TEXT`;
  schemaReady = true;
}

async function readDbTeachers() {
  await ensureTeacherSchema();
  const sql = sqlClient();
  const rows = await sql`
    SELECT id, name, password, initial_password, employee_id, is_system_admin, role
    FROM teachers
    ORDER BY id
  `;

  return rows.map((row) => ({
    id: String(row.id),
    name: row.name ? String(row.name) : "",
    password: row.password ? String(row.password) : "",
    initialPassword: row.initial_password ? String(row.initial_password) : "",
    employeeId: row.employee_id ? String(row.employee_id) : "",
    isSystemAdmin: Boolean(row.is_system_admin),
    role: row.role ? String(row.role) : "",
  })) satisfies TeacherRecord[];
}

async function writeDbTeachers(teachers: TeacherRecord[]) {
  await ensureTeacherSchema();
  const sql = sqlClient();

  for (const teacher of teachers) {
    await sql`
      INSERT INTO teachers (id, name, password, initial_password, employee_id, is_system_admin, role, updated_at)
      VALUES (
        ${teacher.id},
        ${teacher.name ?? ""},
        ${teacher.password ?? ""},
        ${teacher.initialPassword ?? ""},
        ${teacher.employeeId ?? ""},
        ${Boolean(teacher.isSystemAdmin)},
        ${teacher.role ?? ""},
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        password = EXCLUDED.password,
        initial_password = EXCLUDED.initial_password,
        employee_id = EXCLUDED.employee_id,
        is_system_admin = EXCLUDED.is_system_admin,
        role = EXCLUDED.role,
        updated_at = NOW()
    `;
  }
}

async function readBlobTeachers() {
  try {
    const result = await get(BLOB_TEACHERS_PATH, { access: "private" });
    if (!result || result.statusCode !== 200) return null;
    const text = await new Response(result.stream).text();
    return JSON.parse(text) as TeacherRecord[];
  } catch {
    return null;
  }
}

export async function readTeachers() {
  if (dbEnabled()) {
    const dbTeachers = await readDbTeachers();
    if (dbTeachers.length > 0) return dbTeachers;
    return bundledTeachers();
  }

  if (blobEnabled()) {
    const blobTeachers = await readBlobTeachers();
    if (blobTeachers) return blobTeachers;
  }

  return bundledTeachers();
}

export async function writeTeachers(teachers: TeacherRecord[]) {
  if (dbEnabled()) {
    await writeDbTeachers(teachers);
    return;
  }

  if (blobEnabled()) {
    await put(BLOB_TEACHERS_PATH, JSON.stringify(teachers, null, 2), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json; charset=utf-8",
    });
    return;
  }

  writeJsonFileAtomic(bundledTeachersPath(), teachers);
}

export function teachersFileExists() {
  return fs.existsSync(bundledTeachersPath());
}
