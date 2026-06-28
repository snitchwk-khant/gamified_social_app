import { useTheme } from "../../context/theme_context";

function DesktopLayout({ left, center, right }) {
  const { isDark } = useTheme();

  return (
    <div className={`min-h-screen ${isDark ? "bg-slate-950 text-slate-100" : "bg-[#f0f2f5] text-slate-800"}`}>
      <div className="mx-auto grid h-screen w-full max-w-[1460px] grid-cols-1 gap-5 overflow-hidden px-4 py-4 xl:grid-cols-[280px_minmax(0,1fr)_320px] xl:px-6">
        <aside className="hidden min-h-0 flex-col gap-6 xl:flex">
          {left}
        </aside>

        <main
          className={`min-h-0 overflow-hidden rounded-2xl border p-4 xl:p-5 ${
            isDark
              ? "border-slate-800 bg-slate-950 shadow-2xl shadow-slate-950/30"
              : "border-slate-200 bg-white shadow-sm"
          }`}
        >
          {center}
        </main>

        <aside className="hidden min-h-0 flex-col gap-5 xl:flex">
          {right}
        </aside>
      </div>
    </div>
  );
}

export default DesktopLayout;
