import { useTheme } from "../../context/theme_context";
import { useNavigate } from "react-router-dom";

function ChatHeader({ isOnline = false, showBackButton = false }) {
  const { isDark } = useTheme();
  const navigate = useNavigate();

  return (
    <div
      className={`mb-5 rounded-2xl border p-5 ${
        isDark
          ? "border-slate-800 bg-slate-950 shadow-lg shadow-slate-950/20"
          : "border-slate-200 bg-slate-50 shadow-sm"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          {showBackButton ? (
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label="Go back"
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-2xl leading-none transition active:scale-95 ${
                isDark ? "text-slate-100 hover:bg-slate-900" : "text-slate-800 hover:bg-slate-100"
              }`}
            >
              ←
            </button>
          ) : null}
          <h2 className="truncate bg-gradient-to-r from-[#c446ff] to-violet-600 bg-clip-text text-xl font-bold tracking-[0.04em] text-transparent">
            Gemify Room
          </h2>
        </div>
        {isOnline ? (
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              isDark ? "bg-emerald-500 text-slate-950" : "bg-emerald-100 text-emerald-700"
            }`}
          >
            Online
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default ChatHeader;
