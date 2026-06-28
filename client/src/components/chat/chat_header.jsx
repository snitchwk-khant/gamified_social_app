import { useTheme } from "../../context/theme_context";

function ChatHeader({ title, status }) {
  const { isDark } = useTheme();

  return (
    <div
      className={`mb-5 rounded-2xl border p-5 ${
        isDark
          ? "border-slate-800 bg-slate-950 shadow-lg shadow-slate-950/20"
          : "border-slate-200 bg-slate-50 shadow-sm"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.28em] text-slate-500">{status}</p>
          <h2 className={`mt-1 text-xl font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
            {title}
          </h2>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            isDark ? "bg-emerald-500 text-slate-950" : "bg-emerald-100 text-emerald-700"
          }`}
        >
          Online
        </span>
      </div>
    </div>
  );
}

export default ChatHeader;
