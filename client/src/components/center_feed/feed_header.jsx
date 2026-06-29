import { useTheme } from "../../context/theme_context";

function FeedHeader({ subtitle }) {
  const { isDark } = useTheme();

  return (
    <div
      className={`mb-5 flex flex-col gap-2 rounded-2xl border p-6 ${
        isDark
          ? "border-slate-800 bg-slate-950/90 shadow-lg shadow-slate-950/20"
          : "border-slate-200 bg-white shadow-sm"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-slate-500">{subtitle}</p>
        </div>
        <div
          className={`rounded-full px-4 py-2 text-sm font-medium ${
            isDark ? "bg-slate-900 text-slate-300" : "bg-[#f6e8ff] text-[#c446ff]"
          }`}
        >
          Live updates
        </div>
      </div>
    </div>
  );
}

export default FeedHeader;
