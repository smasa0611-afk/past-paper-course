"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, KeyRound } from "lucide-react";

const passwordRuleText = "8文字以上・半角英字と数字を両方含めてください";

function getPasswordValidationError(password: string) {
  if (!password) return "新しいパスワードを入力してください。";
  if (password.length < 8) return "パスワードは8文字以上で入力してください。";
  if (!/^[!-~]+$/.test(password)) return "パスワードは半角英数字・記号で入力してください。";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "パスワードは半角英字と数字を両方含めてください。";
  }
  if (/^(.)\1+$/.test(password)) return "同じ文字だけのパスワードは使えません。";
  return "";
}

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") ?? "");
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!token) {
      setError("再設定リンクが無効です。もう一度メールを送信してください。");
      return;
    }

    const passwordError = getPasswordValidationError(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (!passwordConfirm) {
      setError("新しいパスワード確認を入力してください。");
      return;
    }
    if (password !== passwordConfirm) {
      setError("新しいパスワードが一致しません。");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "パスワード再設定に失敗しました。");
        return;
      }

      setPassword("");
      setPasswordConfirm("");
      setMessage("パスワードを再設定しました。新しいパスワードでログインしてください。");
    } catch {
      setError("パスワード再設定に失敗しました。時間をおいてもう一度お試しください。");
    } finally {
      setSubmitting(false);
    }
  };

  const passwordInput = (
    id: string,
    label: string,
    value: string,
    onChange: (value: string) => void,
    visible: boolean,
    setVisible: (value: boolean) => void,
    placeholder: string,
  ) => (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-bold text-[#20345d]">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="glass-input w-full px-4 py-3.5 pr-12 text-[15px]"
          placeholder={placeholder}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-[#526995] transition hover:bg-white/70 hover:text-[#10203f]"
          aria-label={visible ? `${label}を隠す` : `${label}を表示`}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-[calc(100vh-110px)] items-center justify-center px-4 py-8">
      <div className="glass-card w-full max-w-xl rounded-[32px] p-6 text-[#10203f] shadow-[0_24px_80px_rgba(5,12,28,0.28)] sm:p-8">
        <div className="mb-6">
          <div className="mb-3 inline-flex rounded-full bg-violet-50 p-3 text-violet-700">
            <KeyRound className="h-6 w-6" />
          </div>
          <p className="page-eyebrow mb-3 text-xs font-bold sm:text-sm">RESET PASSWORD</p>
          <h1 className="text-3xl font-black text-[#10203f]">新しいパスワードを設定</h1>
          <p className="mt-3 text-sm leading-7 text-[#55698f]">
            メールで届いたリンクから、30分以内に新しいパスワードを設定してください。
          </p>
        </div>

        <form onSubmit={handleSubmit} autoComplete="off" className="space-y-5">
          {passwordInput("password", "新しいパスワード", password, setPassword, showPassword, setShowPassword, passwordRuleText)}
          {passwordInput(
            "passwordConfirm",
            "新しいパスワード確認",
            passwordConfirm,
            setPasswordConfirm,
            showPasswordConfirm,
            setShowPasswordConfirm,
            "もう一度入力",
          )}

          <p className="text-xs font-bold leading-5 text-[#61759e]">{passwordRuleText}。例: study2026</p>
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
            <KeyRound className="h-5 w-5" />
            {submitting ? "設定中..." : "パスワードを再設定する"}
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
