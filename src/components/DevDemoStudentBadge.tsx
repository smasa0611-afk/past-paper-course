export default function DevDemoStudentBadge() {
  if (process.env.NODE_ENV === "production") return null;

  return (
    <aside className="fixed bottom-3 left-3 z-[60] max-w-[calc(100vw-1.5rem)] rounded-[18px] border border-cyan-200/18 bg-slate-950/72 px-3 py-2 text-[11px] font-bold text-blue-100/82 shadow-[0_18px_42px_rgba(0,5,24,0.46),0_0_24px_rgba(59,130,246,0.12)] backdrop-blur-xl">
      <p className="text-[10px] font-black tracking-[0.18em] text-cyan-200">DEV DEMO STUDENT</p>
      <p className="mt-1 text-white/88">ID: 10000002 / PW: study2026</p>
      <p className="mt-0.5">メール: s.masa0611@gmail.com</p>
    </aside>
  );
}
