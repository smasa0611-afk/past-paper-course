"use client";

import { Lock } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

type MeResponse = {
  user?: {
    isSystemAdmin?: boolean;
  };
};

export default function SystemAdminOnly({ children }: { children: ReactNode }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;

    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return false;
        const data = (await response.json()) as MeResponse;
        return Boolean(data.user?.isSystemAdmin);
      })
      .catch(() => false)
      .then((nextAllowed) => {
        if (active) setAllowed(nextAllowed);
      });

    return () => {
      active = false;
    };
  }, []);

  if (allowed === null) {
    return <div className="min-h-screen bg-slate-50 px-6 py-10 text-slate-700">読み込み中...</div>;
  }

  if (!allowed) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
        <div className="mx-auto max-w-2xl rounded border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded bg-slate-900 text-white">
            <Lock className="h-5 w-5" />
          </div>
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-blue-600">Forbidden</p>
          <h1 className="mt-2 text-2xl font-black">管理者専用ページです</h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            このページを開くにはマスター管理権限が必要です。一般社員アカウントでは設定内容を表示できません。
          </p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
