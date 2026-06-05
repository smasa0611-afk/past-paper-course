import path from "path";
import { readJsonFile, writeJsonFileAtomic } from "@/lib/json-file-store";

type ResetEmailMessage = {
  to: string;
  studentId: string;
  resetUrl: string;
  createdAt: string;
};

function outboxPath() {
  return path.resolve(process.cwd(), "..", "data", "dev-mail-outbox.json");
}

function resendApiKey() {
  return process.env.RESEND_API_KEY ?? "";
}

function fromAddress() {
  return process.env.PASSWORD_RESET_FROM_EMAIL ?? "onboarding@resend.dev";
}

function writeDevOutbox(message: ResetEmailMessage) {
  const outbox = readJsonFile<ResetEmailMessage[]>(outboxPath(), []);
  writeJsonFileAtomic(outboxPath(), [message, ...outbox].slice(0, 20));
  console.info(`Password reset email queued in dev outbox: ${outboxPath()}`);
  return { mode: "dev-outbox" as const };
}

export async function sendPasswordResetEmail(message: ResetEmailMessage) {
  const apiKey = resendApiKey();
  const subject = "パスワード再設定のご案内";
  const text = [
    "パスワード再設定のリクエストを受け付けました。",
    "",
    "以下のリンクから30分以内に新しいパスワードを設定してください。",
    message.resetUrl,
    "",
    "このメールに心当たりがない場合は、何もしなくて大丈夫です。",
  ].join("\n");

  if (apiKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: message.to,
        subject,
        text,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (process.env.NODE_ENV !== "production") {
        console.warn(`Password reset email failed; using dev outbox instead: ${res.status} ${body}`);
        return writeDevOutbox(message);
      }
      throw new Error(`Password reset email failed: ${res.status} ${body}`);
    }

    return { mode: "email" as const };
  }

  return writeDevOutbox(message);
}
