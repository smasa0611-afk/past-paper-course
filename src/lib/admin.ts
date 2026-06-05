import fs from "fs";
import path from "path";
import { requireSession, type SessionUser } from "@/lib/session";

type TeacherRecord = {
  id: string;
  name?: string;
  employeeId?: string;
  isSystemAdmin?: boolean;
  role?: string;
};

const GENERAL_DEMO_TEACHER_ID = "90000001";
const ADMIN_DEMO_TEACHER_ID = "90000002";

function teachersPath() {
  return path.resolve(process.cwd(), "data", "teachers.json");
}

function adminTeacherIds() {
  const configured = process.env.SYSTEM_ADMIN_TEACHER_IDS?.split(",").map((id) => id.trim()).filter(Boolean) ?? [];
  return new Set([...configured, "teacher01", ADMIN_DEMO_TEACHER_ID]);
}

export function isSystemAdmin(user: SessionUser | null | undefined) {
  if (!user || user.role !== "teacher") return false;
  if (user.id === GENERAL_DEMO_TEACHER_ID) return false;
  if (adminTeacherIds().has(user.id)) return true;

  try {
    const filePath = teachersPath();
    if (!fs.existsSync(filePath)) return false;
    const teachers = JSON.parse(fs.readFileSync(filePath, "utf-8")) as TeacherRecord[];
    const teacher = teachers.find((item) => item.id === user.id);
    return Boolean(teacher?.isSystemAdmin || teacher?.role === "admin" || teacher?.role === "system_admin");
  } catch {
    return false;
  }
}

export function getTeacherEmployeeId(teacherId: string) {
  try {
    const filePath = teachersPath();
    if (!fs.existsSync(filePath)) return teacherId;
    const teachers = JSON.parse(fs.readFileSync(filePath, "utf-8")) as TeacherRecord[];
    const teacher = teachers.find((item) => item.id === teacherId);
    return teacher?.employeeId || teacherId;
  } catch {
    return teacherId;
  }
}

export async function requireSystemAdmin() {
  const session = await requireSession("teacher");
  if (!session.ok) return session;
  if (!isSystemAdmin(session.user)) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }
  return { ok: true as const, user: session.user };
}
