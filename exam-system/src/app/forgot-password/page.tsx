"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { MailCheck, Send } from "lucide-react";

export default function ForgotPasswordPage() {
  const [id, setId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const acceptedMessage =
    "再設定リクエストを受け付けました。登録済みメールアドレスがある場合、再設定リンクを送信します。";

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!id.trim()) {
      setError("生徒IDを入力してください。");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: id.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage(acceptedMessage);
        return;
      }

      setMessage(data?.message || acceptedMessage);
    } catch {
      setMessage(acceptedMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-110px)] items-center justify-center px-4 py-8">
      <div className="glass-card w-full max-w-xl rounded-[32px] p-6 text-[#10203f] shadow-[0_24px_80px_rgba(5,12,28,0.28)] sm:p-8">
        <div className="mb-6">
          <div className="mb-3 inline-flex rounded-full bg-blue-50 p-3 text-blue-700">
            <MailCheck className="h-6 w-6" />
          </div>
          <p className="page-eyebrow mb-3 text-xs font-bold sm:text-sm">PASSWORD RESET</p>
          <h1 className="text-3xl font-black text-[#10203f]">パスワードを忘れた方</h1>
          <p className="mt-3 text-sm leading-7 text-[#55698f]">
            生徒IDを入力すると、登録済みメールアドレスに再設定リンクを送信します。
          </p>
        </div>

        <form onSubmit={handleSubmit} autoComplete="off" className="space-y-5">
          <div>
            <label htmlFor="studentId" className="mb-2 block text-sm font-bold text-[#20345d]">
              生徒ID
            </label>
            <input
              id="studentId"
              value={id}
              onChange={(event) => setId(event.target.value)}
              className="glass-input w-full px-4 py-3.5 text-[15px]"
              placeholder="10000002"
              autoComplete="username"
            />
          </div>

          {error && <div className="glass-card-danger rounded-[20px] px-4 py-3 text-sm font-bold text-rose-700">{error}</div>}
          {message && (
            <div className="glass-card-success rounded-[20px] px-4 py-3 text-sm font-bold text-emerald-700">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="glass-button-primary flex w-full items-center justify-center gap-2 px-4 py-4 text-sm font-black disabled:pointer-events-none disabled:opacity-50"
          >
            <Send className="h-5 w-5" />
            {submitting ? "送信中..." : "再設定メールを送る"}
          </button>
        </form>

        <div className="mt-5 text-center">
          <Link href="/login" className="text-sm font-bold text-blue-700 hover:underline">
            ログイン画面へ戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
