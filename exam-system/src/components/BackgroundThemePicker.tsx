"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Check, Palette } from "lucide-react";
import { useBackgroundTheme } from "@/components/BackgroundThemeProvider";

export default function BackgroundThemePicker() {
  const { theme, setTheme, options } = useBackgroundTheme();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="glass-button-secondary inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 py-1.5 text-[11px] font-bold text-[#20345d]"
      >
        <Palette className="h-3.5 w-3.5 text-blue-600" />
        背景設定
      </button>

      {open && (
        <div className="glass-card absolute right-0 top-[calc(100%+12px)] z-[80] w-[320px] rounded-[24px] p-3 text-[#10203f] shadow-[0_24px_64px_rgba(8,16,38,0.28)]">
          <div className="mb-3 px-2">
            <p className="text-sm font-black">背景色</p>
            <p className="mt-1 text-xs text-[#62769d]">画面全体の雰囲気を切り替えます。</p>
          </div>
          <div className="grid gap-3">
            {options.map((option) => {
              const active = option.id === theme;
              const description =
                option.id === "navy"
                  ? "落ち着いた標準テーマ"
                  : option.id === "blue"
                    ? "明るめで爽やかな印象"
                    : "華やかで集中感のある印象";

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setTheme(option.id);
                    setOpen(false);
                  }}
                  className={`glass-hover overflow-hidden rounded-[20px] border text-left transition ${
                    active
                      ? "border-[rgba(111,147,255,0.46)] bg-white/70 shadow-[0_18px_40px_rgba(30,62,151,0.16)]"
                      : "border-[rgba(210,225,255,0.22)] bg-white/52"
                  }`}
                >
                  <div className="relative h-24 w-full">
                    <Image src={option.imagePath} alt={option.label} fill className="object-cover" />
                    <div className={`absolute inset-0 bg-gradient-to-r ${option.accentClass}`} />
                    {active && (
                      <div className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-blue-600 shadow-sm">
                        <Check className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between px-3 py-3">
                    <div>
                      <p className="text-sm font-black text-[#10203f]">{option.label}</p>
                      <p className="mt-1 text-xs text-[#6b7ea5]">{description}</p>
                    </div>
                    {active && <span className="glass-pill px-3 py-1 text-[11px] font-bold text-blue-700">使用中</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
