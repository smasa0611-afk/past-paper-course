"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpenCheck, FileText, GraduationCap } from "lucide-react";

type User = { id: string; name: string; role: "student" | "teacher" };
type SecondaryAccess = { subscribedTargetKeys: string[] };

const practiceModes = [
  {
    href: "/practice/common",
    icon: BookOpenCheck,
    eyebrow: "COMMON TEST",
    title: "共通テスト過去問対策講座",
    description: "共通テスト演習カタログから、全年度・全科目の問題PDF、マーク選択、解答解説PDFを一覧で確認します。",
    status: "2024-2026 実装済み / 5年分へ拡張予定",
  },
  {
    href: "/practice/secondary",
    icon: GraduationCap,
    eyebrow: "SECONDARY EXAM",
    title: "大学別過去問添削講座",
    description: "東大、京大、名大、浜松医科大学医学部の10年分について、問題と解説を表示します。",
    status: "答案アップロード・自動添削は別システムで管理",
  },
];

export default function PracticeHubPage() {
  const [user, setUser] = useState<User | null>(null);
  const [secondaryAccess, setSecondaryAccess] = useState<SecondaryAccess>({ subscribedTargetKeys: [] });

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then((res) => (res.ok ? res.json() : { user: null })),
      fetch("/api/secondary-access").then((res) => (res.ok ? res.json() : { subscribedTargetKeys: [] })),
    ]).then(([me, access]) => {
      setUser(me.user ?? null);
      setSecondaryAccess({
        subscribedTargetKeys: Array.isArray(access.subscribedTargetKeys) ? access.subscribedTargetKeys : [],
      });
    }).catch(() => {
      setUser(null);
      setSecondaryAccess({ subscribedTargetKeys: [] });
    });
  }, []);

  const visiblePracticeModes = useMemo(() => {
    if (user?.role === "teacher" || secondaryAccess.subscribedTargetKeys.length > 0) return practiceModes;
    return practiceModes.filter((mode) => mode.href !== "/practice/secondary");
  }, [secondaryAccess.subscribedTargetKeys.length, user?.role]);

  return (
    <div className="practice-hub-shell min-h-screen text-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-9 md:px-6 md:py-12">
        <div className="practice-hub-heading mb-8">
          <p className="page-eyebrow mb-3 text-sm font-bold">PRACTICE STUDIO</p>
          <h1 className="page-title text-4xl font-black tracking-[0.08em] md:text-6xl">過去問対策講座</h1>
          <p className="page-subtitle mt-5 max-w-4xl border-l-4 border-cyan-300/80 pl-4 text-sm font-bold leading-7 md:text-base">
            共通テスト過去問対策講座と大学別過去問添削講座は、目的も画面の使い方も違うため分けて表示します。
            ここでは問題・解答解説の閲覧を中心に扱い、答案提出や添削は既存の添削システム側と連携する前提です。
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          {visiblePracticeModes.map((mode) => {
            const Icon = mode.icon;
            const isSecondary = mode.href.includes("secondary");
            return (
              <Link
                key={mode.href}
                href={mode.href}
                className={`practice-mode-card group rounded-[30px] p-7 transition hover:-translate-y-0.5 ${
                  isSecondary ? "practice-mode-card-secondary" : "practice-mode-card-common"
                }`}
              >
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div className="practice-mode-icon flex h-16 w-16 items-center justify-center rounded-2xl text-white">
                    <Icon className="h-7 w-7" />
                  </div>
                  <div className="practice-mode-arrow flex h-14 w-14 items-center justify-center rounded-full">
                    <ArrowRight className="h-6 w-6 transition group-hover:translate-x-1" />
                  </div>
                </div>
                <p className="practice-mode-eyebrow text-xs font-black tracking-[0.24em]">{mode.eyebrow}</p>
                <h2 className="mt-3 text-3xl font-black text-white">{mode.title}</h2>
                <p className="mt-5 min-h-16 max-w-xl text-sm font-bold leading-7 text-blue-100/82">{mode.description}</p>
                <div className="practice-mode-status mt-6 inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-bold">
                  <FileText className="h-4 w-4" />
                  {mode.status}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
