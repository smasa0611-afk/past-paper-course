import crypto from "crypto";
import { cookies } from "next/headers";

export type SessionUser = {
  id: string;
  name: string;
  role: "student" | "teacher";
  isSystemAdmin?: boolean;
};

const SESSION_COOKIE = "session";
const SESSION_MAX_AGE = 60 * 60 * 24;
const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-only-session-secret-change-me";

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf-8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf-8");
}

function signPayload(payload: string) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
}

export function createSessionToken(user: SessionUser) {
  const payload = base64UrlEncode(JSON.stringify(user));
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

export function parseSessionToken(token: string) {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  if (signPayload(payload) !== signature) return null;

  try {
    return JSON.parse(base64UrlDecode(payload)) as SessionUser;
  } catch {
    return null;
  }
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE);
  if (!session?.value) return null;
  return parseSessionToken(session.value);
}

export async function requireSession(role?: SessionUser["role"]) {
  const user = await getSessionUser();
  if (!user) return { ok: false as const, status: 401, error: "Unauthorized" };
  if (role && user.role !== role) return { ok: false as const, status: 403, error: "Forbidden" };
  return { ok: true as const, user };
}

export function buildSessionCookieOptions() {
  return {
    httpOnly: true,
    path: "/",
    maxAge: SESSION_MAX_AGE,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}
