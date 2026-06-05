import crypto from "crypto";
import path from "path";
import { readJsonFile, writeJsonFileAtomic } from "@/lib/json-file-store";

export type PasswordResetTokenRecord = {
  id: string;
  studentId: string;
  tokenHash: string;
  expiresAt: string;
  usedAt?: string;
  createdAt: string;
};

const RESET_TOKEN_MAX_AGE_MS = 30 * 60 * 1000;

function resetTokensPath() {
  return path.resolve(process.cwd(), "data", "password-reset-tokens.json");
}

export function hashResetToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("base64url");
}

export function createPasswordResetToken(studentId: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  const now = new Date();
  const record: PasswordResetTokenRecord = {
    id: crypto.randomUUID(),
    studentId,
    tokenHash: hashResetToken(token),
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + RESET_TOKEN_MAX_AGE_MS).toISOString(),
  };

  const records = readJsonFile<PasswordResetTokenRecord[]>(resetTokensPath(), []);
  const activeRecords = records.filter(
    (item) => item.studentId !== studentId && !item.usedAt && new Date(item.expiresAt).getTime() > now.getTime(),
  );
  writeJsonFileAtomic(resetTokensPath(), [...activeRecords, record]);

  return { token, record };
}

export function consumePasswordResetToken(token: string) {
  const now = new Date();
  const tokenHash = hashResetToken(token);
  const records = readJsonFile<PasswordResetTokenRecord[]>(resetTokensPath(), []);
  const index = records.findIndex((item) => item.tokenHash === tokenHash);
  if (index === -1) return { ok: false as const, error: "RESET_TOKEN_INVALID" };

  const record = records[index];
  if (record.usedAt) return { ok: false as const, error: "RESET_TOKEN_USED" };
  if (new Date(record.expiresAt).getTime() <= now.getTime()) {
    return { ok: false as const, error: "RESET_TOKEN_EXPIRED" };
  }

  records[index] = { ...record, usedAt: now.toISOString() };
  writeJsonFileAtomic(resetTokensPath(), records);
  return { ok: true as const, record };
}
