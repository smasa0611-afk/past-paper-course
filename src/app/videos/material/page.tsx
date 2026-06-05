"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, FileText, Printer } from "lucide-react";

function safeMaterialPdfUrl(value: string | null) {
  if (!value) return "";
  if (!value.startsWith("/materials/") || !value.toLowerCase().endsWith(".pdf")) return "";
  return value;
}

function safeReturnTo(value: string | null) {
  if (!value) return "/videos";
  return value.startsWith("/videos") ? value : "/videos";
}

export default function VideoMaterialPage() {
  const printFrameRef = useRef<HTMLIFrameElement | null>(null);
  const [title, setTitle] = useState("＠will授業");
  const [pdfUrl, setPdfUrl] = useState("");
  const [returnTo, setReturnTo] = useState("/videos");
  const [printMessage, setPrintMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setTitle(params.get("title") || "＠will授業");
    setPdfUrl(safeMaterialPdfUrl(params.get("pdf")));
    setReturnTo(safeReturnTo(params.get("returnTo")));
  }, []);

  const handlePrint = () => {
    if (!pdfUrl) return;
    setPrintMessage("");
    const frame = printFrameRef.current;
    if (!frame) return;

    frame.onload = () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } catch {
        setPrintMessage("印刷ダイアログを開けませんでした。PDFプレビュー右上のブラウザ印刷も利用できます。");
      }
    };
    frame.src = `${pdfUrl}#toolbar=0&navpanes=0&print=1&t=${Date.now()}`;
  };

  return (
    <div className="min-h-screen bg-[#04112c] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_72%_12%,rgba(34,211,238,0.20),transparent_28%),linear-gradient(135deg,rgba(37,99,235,0.18),transparent_42%,rgba(14,165,233,0.10))]" />
      <main className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 md:px-6">
        <section className="mb-5 rounded-2xl border border-cyan-200/18 bg-blue-950/52 p-5 shadow-[0_24px_90px_rgba(0,10,30,0.32)] backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-2 text-xs font-black tracking-[0.22em] text-cyan-200">
                <BookOpen className="h-4 w-4" />
                LEVEL UP MATERIAL
              </p>
              <h1 className="mt-2 truncate text-2xl font-black md:text-3xl">{title}</h1>
              <p className="mt-2 text-sm font-bold text-blue-100/68">教材PDFの確認と印刷ができます。</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                disabled={!pdfUrl}
                className="inline-flex items-center gap-2 rounded-full border border-cyan-200/35 bg-cyan-400/14 px-5 py-3 text-sm font-black text-cyan-50 shadow-[0_0_28px_rgba(34,211,238,0.18)] transition hover:bg-cyan-400 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Printer className="h-4 w-4" />
                印刷する
              </button>
              <Link
                href={returnTo}
                className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-5 py-3 text-sm font-black text-blue-100 transition hover:bg-white/14 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                講座に戻る
              </Link>
            </div>
          </div>
        </section>

        <section className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-cyan-200/16 bg-slate-950/78 shadow-[0_24px_90px_rgba(0,10,30,0.38)]">
          {pdfUrl ? (
            <iframe className="h-[calc(100vh-188px)] min-h-[620px] w-full bg-white" src={`${pdfUrl}#toolbar=1&navpanes=0`} title={`${title} 教材PDF`} />
          ) : (
            <div className="flex min-h-[520px] flex-col items-center justify-center p-8 text-center">
              <FileText className="mb-4 h-12 w-12 text-cyan-200" />
              <p className="text-xl font-black">教材PDFが設定されていません</p>
              <p className="mt-2 text-sm font-bold text-blue-100/65">materialPdfUrl がある講座から開いてください。</p>
            </div>
          )}
        </section>

        {printMessage ? <p className="mt-3 text-sm font-bold text-amber-100">{printMessage}</p> : null}
        <iframe ref={printFrameRef} title="教材PDF印刷用" className="hidden" />
      </main>
    </div>
  );
}
