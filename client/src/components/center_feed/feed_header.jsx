import { useTheme } from "../../context/theme_context";

function FeedHeader({ subtitle }) {
  const { isDark } = useTheme();

  return (
    <div
      className={`flex flex-col gap-2 border-y px-3 py-3 sm:rounded-2xl sm:border sm:p-6 ${
        isDark
          ? "border-slate-800 bg-slate-950/90 shadow-lg shadow-slate-950/20"
          : "border-slate-200 bg-white shadow-sm"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-slate-500">{subtitle}</p>
        </div>
        <div
          className={`rounded-full px-3 py-1.5 text-xs font-medium sm:px-4 sm:py-2 sm:text-sm ${
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
