"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type User = {
  id: string;
  name: string;
  role: "student" | "teacher";
};

export default function HeaderHomeLink() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let active = true;

    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => {
        if (active) setUser(data.user);
      })
      .catch(() => {
        if (active) setUser(null);
      });

    return () => {
      active = false;
    };
  }, []);

  const href = useMemo(() => {
    if (user?.role === "teacher") return "/grading";
    if (user?.role === "student") return "/results";
    return "/login";
  }, [user]);

  return (
    <Link href={href} className="group flex min-w-0 flex-1 basis-[235px] items-center gap-2.5 overflow-hidden pr-1 lg:max-w-[380px] 2xl:max-w-[415px]">
      <div className="relative h-8 w-[5.4rem] shrink-0 transition duration-200 group-hover:scale-[1.02] group-hover:opacity-90 lg:h-9 lg:w-[6.3rem] 2xl:w-[7.2rem]">
        <Image
          src="/logo.png"
          alt="過去問対策講座"
          fill
          className="object-contain object-left drop-shadow-[0_8px_24px_rgba(26,48,105,0.22)]"
          priority
        />
      </div>
      <div className="hidden min-w-0 flex-1 sm:block">
        <p
          className="truncate text-[0.92rem] font-semibold tracking-[0.06em] text-[#10203f] lg:text-base"
          style={{ fontFamily: '"Segoe UI", "Yu Gothic UI", sans-serif' }}
        >
          過去問対策講座
        </p>
        <p className="mt-0.5 hidden truncate text-[8px] font-semibold tracking-[0.1em] text-blue-700/80 md:block lg:text-[9px]">
          共通テスト過去問対策講座 / 大学別過去問添削講座
        </p>
      </div>
    </Link>
  );
}
