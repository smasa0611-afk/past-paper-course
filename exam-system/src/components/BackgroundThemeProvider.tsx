"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type BackgroundThemeId = "navy" | "blue" | "red";

export type BackgroundThemeOption = {
  id: BackgroundThemeId;
  label: string;
  imagePath: string;
  accentClass: string;
  overlayLeft: string;
  overlayRight: string;
  overlayDepth: string;
  shellTint: string;
};

const STORAGE_KEY = "app-background-theme";

export const backgroundThemeOptions: BackgroundThemeOption[] = [
  {
    id: "navy",
    label: "ネイビー",
    imagePath: "/images/bg-futuristic-navy.png",
    accentClass: "from-slate-500/60 to-blue-500/60",
    overlayLeft: "radial-gradient(circle at top left, rgba(68, 103, 255, 0.38), transparent 34%)",
    overlayRight: "radial-gradient(circle at top right, rgba(145, 96, 255, 0.32), transparent 30%)",
    overlayDepth: "linear-gradient(180deg, rgba(4, 10, 24, 0.66), rgba(5, 10, 22, 0.88))",
    shellTint: "rgba(88, 122, 255, 0.28)",
  },
  {
    id: "blue",
    label: "ブルー",
    imagePath: "/images/bg-futuristic-blue.png",
    accentClass: "from-cyan-400/70 to-blue-500/70",
    overlayLeft: "radial-gradient(circle at top left, rgba(34, 211, 238, 0.46), transparent 36%)",
    overlayRight: "radial-gradient(circle at top right, rgba(37, 99, 235, 0.42), transparent 32%)",
    overlayDepth: "linear-gradient(180deg, rgba(2, 18, 40, 0.56), rgba(4, 20, 46, 0.82))",
    shellTint: "rgba(14, 165, 233, 0.34)",
  },
  {
    id: "red",
    label: "レッド",
    imagePath: "/images/bg-futuristic-red.png",
    accentClass: "from-rose-500/70 to-fuchsia-600/70",
    overlayLeft: "radial-gradient(circle at top left, rgba(244, 63, 94, 0.5), transparent 38%)",
    overlayRight: "radial-gradient(circle at top right, rgba(217, 70, 239, 0.42), transparent 34%)",
    overlayDepth: "linear-gradient(180deg, rgba(45, 7, 20, 0.52), rgba(48, 8, 24, 0.82))",
    shellTint: "rgba(244, 63, 94, 0.32)",
  },
];

type BackgroundThemeContextType = {
  theme: BackgroundThemeId;
  setTheme: (theme: BackgroundThemeId) => void;
  options: BackgroundThemeOption[];
};

const BackgroundThemeContext = createContext<BackgroundThemeContextType | null>(null);

function applyTheme(themeId: BackgroundThemeId) {
  const selected =
    backgroundThemeOptions.find((option) => option.id === themeId) ??
    backgroundThemeOptions[0];

  document.documentElement.style.setProperty("--app-bg-image", `url('${selected.imagePath}')`);
  document.documentElement.style.setProperty("--app-bg-overlay-left", selected.overlayLeft);
  document.documentElement.style.setProperty("--app-bg-overlay-right", selected.overlayRight);
  document.documentElement.style.setProperty("--app-bg-overlay-depth", selected.overlayDepth);
  document.documentElement.style.setProperty("--app-shell-tint", selected.shellTint);
}

export function BackgroundThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<BackgroundThemeId>("navy");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(STORAGE_KEY) as BackgroundThemeId | null;
    const initial = backgroundThemeOptions.some((option) => option.id === saved) ? (saved as BackgroundThemeId) : "navy";

    setThemeState(initial);
    applyTheme(initial);
  }, []);

  const setTheme = (nextTheme: BackgroundThemeId) => {
    setThemeState(nextTheme);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, nextTheme);
    }
    applyTheme(nextTheme);
  };

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      options: backgroundThemeOptions,
    }),
    [theme],
  );

  return <BackgroundThemeContext.Provider value={value}>{children}</BackgroundThemeContext.Provider>;
}

export function useBackgroundTheme() {
  const context = useContext(BackgroundThemeContext);
  if (!context) {
    throw new Error("useBackgroundTheme must be used within BackgroundThemeProvider");
  }
  return context;
}
