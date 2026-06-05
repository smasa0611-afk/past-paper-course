"use client";

import { usePathname } from "next/navigation";
import AuthNav from "@/components/AuthNav";
import HeaderHomeLink from "@/components/HeaderHomeLink";

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const pageOwnsHeader = false;

  return (
    <>
      {!pageOwnsHeader && (
        <header className="sticky top-0 z-50 px-3 py-1.5 md:px-5 md:py-2">
          <div className="glass-header mx-auto flex min-h-[58px] max-w-[1760px] flex-wrap items-center justify-between gap-x-2.5 gap-y-1.5 overflow-visible rounded-[22px] px-3 py-1.5 text-slate-900 md:px-5">
            <HeaderHomeLink />
            <AuthNav />
          </div>
        </header>
      )}
      <main className="relative z-0 flex flex-1 flex-col pb-8">{children}</main>
    </>
  );
}
