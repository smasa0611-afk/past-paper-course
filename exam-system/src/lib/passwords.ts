import crypto from "crypto";

const PREFIX = "pbkdf2";
const ITERATIONS = 120_000;
const KEY_LENGTH = 32;
const DIGEST = "sha256";

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("base64url");
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString("base64url");
  return `${PREFIX}$${ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password: string | undefined, stored: string | undefined) {
  if (!password || !stored) return false;

  const [prefix, iterationsText, salt, expectedHash] = stored.split("$");
  if (prefix !== PREFIX || !iterationsText || !salt || !expectedHash) {
    return password === stored;
  }

  const iterations = Number(iterationsText);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;

  const actualHash = crypto.pbkdf2Sync(password, salt, iterations, KEY_LENGTH, DIGEST).toString("base64url");
  const actual = Buffer.from(actualHash);
  const expected = Buffer.from(expectedHash);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
