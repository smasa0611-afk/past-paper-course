import type { Metadata } from "next";
import "./globals.css";
import AppChrome from "@/components/AppChrome";
import { BgmProvider } from "@/components/BgmProvider";
import { BackgroundThemeProvider } from "@/components/BackgroundThemeProvider";
import DevDemoStudentBadge from "@/components/DevDemoStudentBadge";

export const metadata: Metadata = {
  title: "過去問対策講座",
  description: "共通テスト過去問対策講座と大学別過去問添削講座の学習システム",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="relative min-h-full overflow-x-hidden bg-background text-foreground">
        <BackgroundThemeProvider>
          <BgmProvider>
            <div className="app-bg-grid pointer-events-none fixed inset-0 -z-20 opacity-35" />
            <div
              className="pointer-events-none fixed inset-0 -z-10"
              style={{
                background: "var(--app-bg-overlay-left), var(--app-bg-overlay-right), var(--app-bg-overlay-depth)",
              }}
            />
            <AppChrome>{children}</AppChrome>
            <DevDemoStudentBadge />
          </BgmProvider>
        </BackgroundThemeProvider>
      </body>
    </html>
  );
}
