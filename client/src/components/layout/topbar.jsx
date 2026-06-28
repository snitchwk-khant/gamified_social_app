import { useAuth } from "../../context/auth_context";
import { useTheme } from "../../context/theme_context";

function Topbar() {
  const { user, signOut } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const displayName = user?.full_name || user?.name || user?.email?.split("@")[0] || "Team member";
  const initials = user?.initials || displayName?.charAt(0)?.toUpperCase() || "T";

  return (
    <div
      className={`flex items-center justify-between rounded-xl border px-4 py-3 sm:px-5 sm:py-4 ${
        isDark
          ? "border-slate-800 bg-slate-950 shadow-lg shadow-slate-950/20"
          : "border-slate-200 bg-white shadow-sm"
      }`}
    >
      <div>
        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Team feed</p>
        <h1 className={`text-xl font-semibold sm:text-2xl ${isDark ? "text-slate-100" : "text-slate-900"}`}>
          Company social experience
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleTheme}
          className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
            isDark
              ? "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
          }`}
        >
          {isDark ? "Light mode" : "Dark mode"}
        </button>
        <button
          onClick={signOut}
          className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
            isDark
              ? "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
          }`}
        >
          Sign Out
        </button>
        <div
          className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm ${
            isDark
              ? "border-slate-700 bg-slate-900 text-slate-100"
              : "border-slate-300 bg-slate-50 text-slate-800"
          }`}
        >
          <div
            className={`flex h-8 w-8 items-center justify-center overflow-hidden rounded-full ${
              isDark ? "bg-sky-500 text-slate-950" : "bg-[#c446ff] text-white"
            }`}
          >
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs font-semibold">{initials}</span>
            )}
          </div>
          <span className="hidden sm:inline">{displayName}</span>
        </div>
      </div>
    </div>
  );
}

export default Topbar;
