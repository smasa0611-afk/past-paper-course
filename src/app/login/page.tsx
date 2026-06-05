"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { Dice5, Eye, EyeOff, LogIn, RefreshCcw, ShieldCheck } from "lucide-react";
import {
  buildNickname,
  createNicknameNumber,
  createNicknameOptions,
  nicknameGenres,
  NICKNAME_REFRESH_LIMIT,
  type NicknameGenre,
} from "@/lib/nicknames";

type Role = "student" | "teacher";
type AuthMode = "login" | "setup";

const teacherDemos = [
  {
    id: "90000001",
    password: "Demo2026",
    quickLogin: false,
    label: "デモ教師",
    note: "一般社員デモ",
  },
  {
    id: "90000002",
    password: "Admin2026",
    quickLogin: true,
    label: "管理者デモ教師",
    note: "マスター管理デモ",
  },
] as const;

const studentDemo = {
  id: "10000002",
  password: "study2026",
};

const initialSetupDemo = {
  id: "10000007",
  password: "a1B2c3D4",
};

const devQuickLoginStudents = [
  { id: "10000003", password: "meidai2026", label: "meidai2026", target: "Nagoya Engineering" },
  { id: "10000004", password: "kyodai2026", label: "kyodai2026", target: "Kyoto Economics" },
  { id: "10000005", password: "hamai2026", label: "hamai2026", target: "Hamamatsu Medicine" },
  { id: "10000006", password: "sizudai2026", label: "sizudai2026", target: "Shizuoka Law" },
] as const;

const passwordRuleText = "8文字以上、半角英字と数字を両方含めてください";

function isNicknameGenre(value: string): value is NicknameGenre {
  return nicknameGenres.includes(value as NicknameGenre);
}

function getPasswordValidationError(password: string, id: string) {
  if (!password) return "新しいパスワードを入力してください。";
  if (password.length < 8) return "新しいパスワードは8文字以上で入力してください。";
  if (!/^[!-~]+$/.test(password)) return "新しいパスワードは半角英数字・記号で入力してください。";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "新しいパスワードは半角英字と数字を両方含めてください。";
  }
  if (/^(.)\1+$/.test(password)) return "同じ文字だけのパスワードは使えません。";
  if (id && password === id) return "IDと同じパスワードは使えません。";
  return "";
}

export default function LoginPage() {
  const [role, setRole] = useState<Role>("student");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [initialPassword, setInitialPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [targetRate, setTargetRate] = useState("80");
  const [nicknameGenre, setNicknameGenre] = useState<NicknameGenre | "">("");
  const [nicknameOptions, setNicknameOptions] = useState<string[]>([]);
  const [nicknameCandidate, setNicknameCandidate] = useState("");
  const [nicknameNumber, setNicknameNumber] = useState("");
  const [refreshCount, setRefreshCount] = useState(0);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  const completedNickname = useMemo(() => {
    if (!nicknameCandidate || !nicknameNumber) return "";
    return buildNickname(nicknameCandidate, nicknameNumber);
  }, [nicknameCandidate, nicknameNumber]);

  const resetNicknameSetup = () => {
    setNicknameGenre("");
    setNicknameOptions([]);
    setNicknameCandidate("");
    setNicknameNumber("");
    setRefreshCount(0);
  };

  const resetForRole = (nextRole: Role) => {
    setRole(nextRole);
    setAuthMode("login");
    setPassword("");
    setInitialPassword("");
    setNewPassword("");
    setPasswordConfirm("");
    setTargetRate("80");
    resetNicknameSetup();
    setError("");
  };

  const fillCredentials = (nextRole: Role, nextId: string, nextPassword: string) => {
    resetForRole(nextRole);
    setId(nextId);
    setPassword(nextPassword);
  };

  const startSetup = (verifiedInitialPassword: string) => {
    setInitialPassword(verifiedInitialPassword);
    setNewPassword("");
    setPasswordConfirm("");
    resetNicknameSetup();
    if (role === "student") setNicknameNumber(createNicknameNumber());
    setAuthMode("setup");
  };

  const handleGenreChange = (value: string) => {
    if (!isNicknameGenre(value)) {
      resetNicknameSetup();
      return;
    }

    setNicknameGenre(value);
    setNicknameOptions(createNicknameOptions(value));
    setNicknameCandidate("");
    setNicknameNumber(createNicknameNumber());
    setRefreshCount(0);
    setError("");
  };

  const refreshNicknames = () => {
    if (!nicknameGenre || refreshCount >= NICKNAME_REFRESH_LIMIT) return;
    setNicknameOptions(createNicknameOptions(nicknameGenre));
    setNicknameCandidate("");
    setRefreshCount((current) => current + 1);
    setError("");
  };

  const quickLoginAsDevStudent = async (student: (typeof devQuickLoginStudents)[number]) => {
    setError("");
    setSubmitting(true);
    fillCredentials("student", student.id, student.password);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: student.id, password: student.password, role: "student" }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "ログインに失敗しました。");
        return;
      }

      window.location.href = "/results";
    } finally {
      setSubmitting(false);
    }
  };

  const quickLoginAsTeacherDemo = async (teacherDemo: (typeof teacherDemos)[number]) => {
    setError("");
    setSubmitting(true);
    fillCredentials("teacher", teacherDemo.id, teacherDemo.password);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: teacherDemo.id, password: teacherDemo.password, role: "teacher" }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "ログインに失敗しました。");
        return;
      }

      window.location.href = "/grading";
    } finally {
      setSubmitting(false);
    }
  };

  const login = async () => {
    const trimmedId = id.trim();
    if (!/^\d{8}$/.test(trimmedId)) {
      setError(role === "teacher" ? "社員IDは8桁の数字で入力してください。" : "生徒IDは8桁の数字で入力してください。");
      return;
    }

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: trimmedId, password, role }),
    });
    const data = await res.json();

    if (!res.ok) {
      if (data.setupRequired && data.initialVerified) {
        startSetup(password);
        setError("");
        return;
      }
      setError(data.error || "ログインに失敗しました。");
      return;
    }

    window.location.href = role === "teacher" ? "/grading" : "/results";
  };

  const setupAccount = async () => {
    const trimmedId = id.trim();
    if (!/^\d{8}$/.test(trimmedId)) {
      setError(role === "teacher" ? "社員IDは8桁の数字で入力してください。" : "生徒IDは8桁の数字で入力してください。");
      return;
    }

    const passwordError = getPasswordValidationError(newPassword, trimmedId);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (!passwordConfirm) {
      setError("新しいパスワード確認を入力してください。");
      return;
    }
    if (newPassword !== passwordConfirm) {
      setError("新しいパスワードが一致しません。");
      return;
    }

    if (role === "teacher") {
      const res = await fetch("/api/auth/teacher-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: trimmedId, initialPassword, password: newPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "初回設定に失敗しました。");
        return;
      }

      window.location.href = "/grading";
      return;
    }

    const parsedTargetRate = Number(targetRate);
    if (!Number.isFinite(parsedTargetRate) || parsedTargetRate < 40 || parsedTargetRate > 100) {
      setError("共通テストの目標得点率は40〜100の範囲で入力してください。");
      return;
    }
    if (!nicknameGenre) {
      setError("ニックネームのジャンルを選択してください。");
      return;
    }
    if (!nicknameCandidate) {
      setError("ニックネーム候補を選択してください。");
      return;
    }
    if (!/^\d{3}$/.test(nicknameNumber)) {
      setError("末尾の数字は3桁で入力してください。");
      return;
    }
    if (!completedNickname) {
      setError("表示名を完成させてください。");
      return;
    }

    const res = await fetch("/api/auth/student-setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: trimmedId,
        initialPassword,
        password: newPassword,
        nickname: completedNickname,
        targetRate: parsedTargetRate,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "初回設定に失敗しました。");
      return;
    }

    window.location.href = "/results";
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      if (authMode === "setup") {
        await setupAccount();
      } else {
        await login();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const refreshRemaining = NICKNAME_REFRESH_LIMIT - refreshCount;

  return (
    <div className="login-page-shell min-h-[calc(100vh-110px)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-140px)] w-full max-w-[1600px] gap-8 lg:grid-cols-[1.18fr_0.82fr] xl:gap-10">
        <section className="flex items-center">
          <div className="login-hero-outer glass-card relative w-full overflow-hidden rounded-[32px] p-4 shadow-[0_24px_80px_rgba(5,12,28,0.28)]">
            <div
              className="login-hero-image relative min-h-[440px] overflow-hidden rounded-[28px] border border-white/20 lg:min-h-[720px]"
              style={{
                backgroundImage:
                  "linear-gradient(180deg, rgba(5,10,24,0.02) 0%, rgba(5,10,24,0.42) 100%), url('/hero.png')",
                backgroundSize: "auto 112%",
                backgroundPosition: "72% center",
              }}
            >
              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                <div className="login-copy-panel max-w-xl rounded-[28px] border border-white/18 p-5 shadow-[0_18px_44px_rgba(5,12,28,0.22)] backdrop-blur-[10px] sm:p-6">
                  <p className="mb-3 text-xs font-bold tracking-[0.18em] text-blue-200 sm:text-sm">演習講座ログイン</p>
                  <h1 className="text-3xl font-black leading-tight text-white sm:text-4xl">
                    IDとパスワードで安全にログイン
                  </h1>
                  <p className="mt-3 max-w-lg text-sm font-medium leading-7 text-blue-100/88 sm:text-[15px]">
                    生徒も社員も初回は8桁IDと初期パスワードで本人確認し、その後に新しいパスワードを設定します。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center lg:justify-end">
          <div className="login-auth-panel glass-card w-full max-w-xl rounded-[32px] p-6 text-[#10203f] shadow-[0_24px_80px_rgba(5,12,28,0.28)] sm:p-8">
            <div className="mb-8">
              <p className="page-eyebrow mb-3 text-xs font-bold sm:text-sm">
                {role === "teacher" ? "社員ログイン" : authMode === "setup" ? "初回設定" : "生徒ログイン"}
              </p>
              <h1 className="text-3xl font-black text-[#10203f] sm:text-[2.2rem]">アカウントでログイン</h1>
              <p className="mt-3 text-sm leading-7 text-[#55698f]">
                初回ログインでは初期パスワードを確認後、新しいパスワードを設定します。
                社員はニックネーム設定なしで進めます。
              </p>
            </div>

            <form onSubmit={handleSubmit} autoComplete="off" className="flex flex-col gap-5">
              <div>
                <label className="mb-2 block text-sm font-bold text-[#20345d]">利用区分</label>
                <div className="glass-card-soft grid grid-cols-2 gap-2 rounded-[20px] p-1.5">
                  {(["student", "teacher"] as Role[]).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => resetForRole(item)}
                      className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
                        role === item
                          ? "bg-[linear-gradient(135deg,#457cff_0%,#6e67ff_100%)] text-white shadow-[0_14px_30px_rgba(65,97,214,0.28)]"
                          : "text-[#576b94] hover:bg-white/70 hover:text-[#10203f]"
                      }`}
                    >
                      {item === "student" ? "生徒" : "社員"}
                    </button>
                  ))}
                </div>
              </div>

              {role === "teacher" && authMode === "login" && (
                <div className="grid gap-2">
                  {teacherDemos.map((teacherDemo) => (
                    <button
                      key={teacherDemo.id}
                      type="button"
                      onClick={() =>
                        teacherDemo.quickLogin
                          ? quickLoginAsTeacherDemo(teacherDemo)
                          : fillCredentials("teacher", teacherDemo.id, teacherDemo.password)
                      }
                      disabled={submitting}
                      className="login-demo-card glass-card-soft glass-hover flex items-center justify-between gap-3 rounded-[20px] px-4 py-3 text-left disabled:pointer-events-none disabled:opacity-50"
                    >
                      <span>
                        <span className="block font-black text-[#10203f]">{teacherDemo.label}</span>
                        <span className="mt-1 block text-xs text-[#61759e]">{teacherDemo.note}</span>
                      </span>
                      <span className="text-right font-mono text-xs text-[#4d6390]">
                        {teacherDemo.id}
                        <br />
                        {teacherDemo.password}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {role === "student" && authMode === "login" && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => fillCredentials("student", studentDemo.id, studentDemo.password)}
                      className="login-demo-card login-demo-card-primary glass-card-soft glass-hover rounded-[16px] px-3 py-2.5 text-left"
                    >
                      <span className="block truncate text-xs font-black text-[#10203f]">設定済みデモ</span>
                      <span className="mt-1 block font-mono text-[11px] leading-4 text-[#4d6390]">
                        {studentDemo.id}
                        <br />
                        {studentDemo.password}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fillCredentials("student", initialSetupDemo.id, initialSetupDemo.password)}
                      className="login-demo-card glass-card-soft glass-hover rounded-[16px] px-3 py-2.5 text-left"
                    >
                      <span className="block truncate text-xs font-black text-[#10203f]">初回設定デモ</span>
                      <span className="mt-1 block font-mono text-[11px] leading-4 text-[#4d6390]">
                        {initialSetupDemo.id}
                        <br />
                        {initialSetupDemo.password}
                      </span>
                    </button>
                  </div>

                  <div className="rounded-[20px] border border-emerald-200/70 bg-emerald-50/70 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-emerald-900">デモ生徒ログイン</span>
                      <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-black text-white">1 CLICK</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {devQuickLoginStudents.map((student) => (
                        <button
                          key={student.id}
                          type="button"
                          onClick={() => quickLoginAsDevStudent(student)}
                          disabled={submitting}
                          className="login-demo-card glass-card-soft glass-hover rounded-[16px] px-3 py-2.5 text-left disabled:pointer-events-none disabled:opacity-50"
                        >
                          <span className="block truncate text-xs font-black text-[#10203f]">{student.label}</span>
                          <span className="mt-1 block truncate text-[10px] font-bold text-[#61759e]">{student.target}</span>
                          <span className="mt-1 block font-mono text-[11px] leading-4 text-[#4d6390]">{student.id}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div>
                <label htmlFor="id" className="mb-2 block text-sm font-bold text-[#20345d]">
                  {role === "teacher" ? "社員ID（8桁）" : "生徒ID（8桁）"}
                </label>
                <input
                  id="id"
                  value={id}
                  onChange={(event) => {
                    setId(event.target.value);
                    setAuthMode("login");
                  }}
                  className="glass-input w-full px-4 py-3.5 text-[15px]"
                  placeholder={role === "teacher" ? "90000001" : "10000001"}
                  autoComplete="username"
                  disabled={authMode === "setup"}
                />
              </div>

              {authMode === "login" && (
                <div>
                  <label htmlFor="password" className="mb-2 block text-sm font-bold text-[#20345d]">
                    {role === "teacher" ? "パスワード（初回は初期パスワード）" : "パスワード"}
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="glass-input w-full px-4 py-3.5 pr-12 text-[15px]"
                      placeholder={role === "teacher" ? "初期パスワードまたは設定済みパスワード" : "初回は初期パスワード"}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-[#526995] transition hover:bg-white/70 hover:text-[#10203f]"
                      aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              {authMode === "setup" && (
                <>
                  <div className="rounded-[20px] border border-blue-200/70 bg-blue-50/70 px-4 py-3 text-sm font-bold leading-6 text-blue-900">
                    初期パスワードを確認しました。新しいパスワードを設定してください。
                    {role === "student" ? " 生徒は続けて表示用ニックネームも設定します。" : " 社員はニックネーム設定は不要です。"}
                  </div>

                  <div>
                    <label htmlFor="newPassword" className="mb-2 block text-sm font-bold text-[#20345d]">
                      新しいパスワード
                    </label>
                    <div className="relative">
                      <input
                        id="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(event) => setNewPassword(event.target.value)}
                        className="glass-input w-full px-4 py-3.5 pr-12 text-[15px]"
                        placeholder={passwordRuleText}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((current) => !current)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-[#526995] transition hover:bg-white/70 hover:text-[#10203f]"
                        aria-label={showNewPassword ? "新しいパスワードを隠す" : "新しいパスワードを表示"}
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="mt-2 text-xs font-bold leading-5 text-[#61759e]">{passwordRuleText}。</p>
                  </div>

                  <div>
                    <label htmlFor="passwordConfirm" className="mb-2 block text-sm font-bold text-[#20345d]">
                      新しいパスワード確認
                    </label>
                    <div className="relative">
                      <input
                        id="passwordConfirm"
                        type={showPasswordConfirm ? "text" : "password"}
                        value={passwordConfirm}
                        onChange={(event) => setPasswordConfirm(event.target.value)}
                        className="glass-input w-full px-4 py-3.5 pr-12 text-[15px]"
                        placeholder="もう一度入力"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswordConfirm((current) => !current)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-[#526995] transition hover:bg-white/70 hover:text-[#10203f]"
                        aria-label={showPasswordConfirm ? "パスワード確認を隠す" : "パスワード確認を表示"}
                      >
                        {showPasswordConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {role === "student" && (
                    <>
                      <label className="rounded-[20px] border border-cyan-200/50 bg-cyan-50/80 px-4 py-4 text-blue-950">
                        <span className="block text-sm font-black">共通テスト目標得点率</span>
                        <span className="mt-1 block text-xs font-bold leading-5 text-blue-900/72">
                          初回のみ生徒が設定します。設定後の修正は教師管理画面で行います。
                        </span>
                        <div className="mt-3 flex items-center gap-3">
                          <input
                            type="range"
                            min="40"
                            max="100"
                            value={targetRate}
                            onChange={(event) => setTargetRate(event.target.value)}
                            className="min-w-0 flex-1 accent-blue-600"
                          />
                          <input
                            type="number"
                            min="40"
                            max="100"
                            value={targetRate}
                            onChange={(event) => setTargetRate(event.target.value)}
                            className="w-24 rounded-xl border border-blue-200 bg-white px-3 py-2 text-center text-xl font-black text-blue-800"
                          />
                          <span className="font-black text-blue-900">%</span>
                        </div>
                      </label>

                      <div className="glass-card-violet rounded-[24px] p-4">
                        <div className="mb-4">
                          <p className="text-sm font-black text-[#10203f]">ニックネーム設定</p>
                          <p className="mt-2 text-xs font-bold leading-5 text-[#61759e]">
                            ジャンルから候補を選び、末尾に3桁の数字を付けます。
                          </p>
                        </div>

                        <div className="mb-4">
                          <label htmlFor="nicknameGenre" className="mb-2 block text-sm font-bold text-[#20345d]">
                            ジャンル
                          </label>
                          <select
                            id="nicknameGenre"
                            value={nicknameGenre}
                            onChange={(event) => handleGenreChange(event.target.value)}
                            className="glass-input w-full bg-[#0d1b38] px-4 py-3.5 text-[15px] font-bold text-white [color-scheme:dark]"
                            style={{ colorScheme: "dark" }}
                          >
                            <option value="" className="bg-[#0d1b38] text-white">ジャンルを選択</option>
                            {nicknameGenres.map((genre) => (
                              <option key={genre} value={genre} className="bg-[#0d1b38] text-white">
                                {genre}
                              </option>
                            ))}
                          </select>
                        </div>

                        {nicknameGenre && (
                          <>
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <p className="text-xs font-bold text-[#61759e]">候補から1つ選んでください。</p>
                              <button
                                type="button"
                                onClick={refreshNicknames}
                                disabled={refreshRemaining <= 0}
                                className="glass-button-secondary inline-flex items-center gap-2 px-3 py-2 text-xs font-bold text-violet-700 disabled:pointer-events-none disabled:opacity-45"
                              >
                                <RefreshCcw className="h-4 w-4" />
                                候補を更新
                              </button>
                            </div>
                            <p className="mb-3 text-xs font-bold text-[#61759e]">候補の更新はあと{refreshRemaining}回できます。</p>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {nicknameOptions.map((item) => (
                                <button
                                  key={item}
                                  type="button"
                                  onClick={() => setNicknameCandidate(item)}
                                  className={`nickname-option-button rounded-[18px] border px-3 py-3 text-left text-sm font-black transition ${
                                    nicknameCandidate === item
                                      ? "nickname-option-button-active border-violet-500 bg-white shadow-[0_12px_28px_rgba(109,40,217,0.22)]"
                                      : "border-blue-200/80 bg-white shadow-[0_10px_22px_rgba(2,10,31,0.12)] hover:border-violet-300 hover:bg-[#f6f3ff]"
                                  }`}
                                >
                                  {item}
                                </button>
                              ))}
                            </div>
                          </>
                        )}

                        <div className="mt-4">
                          <label htmlFor="nicknameNumber" className="mb-2 block text-sm font-bold text-[#20345d]">
                            末尾の3桁数字
                          </label>
                          <input
                            id="nicknameNumber"
                            value={nicknameNumber}
                            onChange={(event) => setNicknameNumber(event.target.value.replace(/\D/g, "").slice(0, 3))}
                            inputMode="numeric"
                            maxLength={3}
                            pattern="[0-9]{3}"
                            className="glass-input w-full px-4 py-3.5 text-[15px] font-black tracking-[0.24em]"
                            placeholder="000"
                          />
                        </div>

                        <div className="mt-4 flex items-start gap-2 rounded-[18px] bg-white/60 px-3 py-3 text-xs font-bold leading-5 text-[#526995]">
                          <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-violet-600" />
                          <span>
                            表示名プレビュー:
                            <span className="ml-1 text-sm font-black text-[#10203f]">
                              {completedNickname || "ジャンル・候補・3桁数字を選ぶと表示されます"}
                            </span>
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {error && (
                <div className="glass-card-danger rounded-[20px] px-4 py-3 text-sm font-bold text-rose-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="login-primary-button glass-button-primary mt-2 flex w-full items-center justify-center gap-2 px-4 py-4 text-sm font-black disabled:pointer-events-none disabled:opacity-50"
              >
                {authMode === "setup" ? <Dice5 className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}
                {submitting ? "処理中..." : authMode === "setup" ? "初回設定してログイン" : "ログイン"}
              </button>
              {role === "student" && authMode === "login" && (
                <div className="text-center">
                  <Link href="/forgot-password" className="text-sm font-bold text-blue-700 hover:underline">
                    パスワードを忘れた方はこちら
                  </Link>
                </div>
              )}
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
