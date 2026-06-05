"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Music, Volume2, VolumeX } from "lucide-react";
import BackgroundThemePicker from "@/components/BackgroundThemePicker";
import { useBgm } from "@/components/BgmProvider";

type User = {
  id: string;
  name: string;
  role: "student" | "teacher";
  isSystemAdmin?: boolean;
};

type CourseProfile = {
  hasSecondaryCourse?: boolean;
};

const teacherLinks = [
  { href: "/grading", label: "進捗確認" },
  { href: "/grading/deadlines", label: "締切設定" },
  { href: "/practice", label: "演習カタログ" },
  { href: "/videos", label: "映像授業" },
  { href: "/ranking", label: "ランキング" },
];

const studentLinks = [
  { href: "/results", label: "共通テスト演習データ" },
  { href: "/secondary-results", label: "2次演習データ", secondaryOnly: true },
  { href: "/practice", label: "演習カタログ" },
  { href: "/videos", label: "映像授業" },
  { href: "/ranking", label: "ランキング" },
];

export default function AuthNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { enabled, ready, toggle, volume, setVolume } = useBgm();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<CourseProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => {
        if (active) setUser(data.user);
        if (data.user?.role === "student") {
          fetch("/api/student-course-profile")
            .then((res) => (res.ok ? res.json() : null))
            .then((profileData) => {
              if (active) setProfile(profileData);
            })
            .catch(() => {
              if (active) setProfile(null);
            });
        } else if (active) {
          setProfile(null);
        }
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [pathname]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/login");
    router.refresh();
  };

  const links =
    user?.role === "teacher"
      ? user.isSystemAdmin
        ? [...teacherLinks, { href: "/settings", label: "設定" }]
        : teacherLinks
      : studentLinks.filter((link) => !link.secondaryOnly || profile?.hasSecondaryCourse);

  return (
    <nav className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1 overflow-visible">
      {user && (
        <div className="hidden shrink-0 items-center gap-1 rounded-full border border-white/40 bg-white/45 px-1 py-1.5 shadow-[0_10px_24px_rgba(10,20,45,0.08)] backdrop-blur-md lg:flex">
          {links.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-bold tracking-[0.02em] transition-all ${
                  active
                    ? "bg-white text-[#19335f] shadow-[0_10px_24px_rgba(40,74,173,0.15)]"
                    : "text-[#31486f] hover:bg-white/70 hover:text-[#10203f]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      )}

      {loading ? (
        <span className="glass-pill shrink-0 px-3 py-2 text-xs font-semibold text-[#55698f]">読み込み中...</span>
      ) : user ? (
        <>
          <BackgroundThemePicker />

          <div className="glass-card-soft hidden shrink-0 items-center gap-1 rounded-2xl px-1.5 py-1 text-[#20345d] xl:flex">
            <button
              type="button"
              onClick={() => void toggle()}
              disabled={!ready}
              className="glass-button-secondary inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1 text-[10px] font-bold disabled:opacity-50"
            >
              {enabled ? <Music className="h-3.5 w-3.5 text-blue-600" /> : <VolumeX className="h-3.5 w-3.5 text-slate-500" />}
              {enabled ? "BGMオン" : "BGMオフ"}
            </button>

            <div className="glass-pill flex items-center gap-1.5 px-2.5 py-1">
              <Volume2 className="h-3 w-3 text-[#6a7da5]" />
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={volume}
                onChange={(event) => setVolume(Number(event.target.value))}
                className="h-2 w-14 accent-blue-600 2xl:w-[4.5rem]"
                aria-label="BGM音量"
              />
              <span className="w-7 text-right text-[10px] font-bold text-[#5a6f99]">{volume}</span>
            </div>
          </div>

          <div className="glass-card-soft flex shrink-0 items-center gap-1.5 rounded-2xl px-2.5 py-1 text-[#21355f]">
            <div className="flex flex-col">
              <span className="text-[11px] text-[#6a7da5]">{user.role === "teacher" ? "教師" : "生徒"}</span>
              <span className="max-w-24 truncate text-xs font-black text-[#10203f] md:text-[13px] 2xl:max-w-28">{user.name}</span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-xl border border-rose-200/80 bg-white/70 px-2.5 py-1 text-[10px] font-bold text-rose-600 shadow-[0_10px_24px_rgba(120,45,78,0.08)] transition hover:-translate-y-0.5 hover:bg-rose-50"
            >
              ログアウト
            </button>
          </div>
        </>
      ) : (
        <Link href="/login" className="glass-button-primary shrink-0 px-3.5 py-1.5 text-[10px] font-bold">
          ログイン
        </Link>
      )}
    </nav>
  );
}
