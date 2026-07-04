import { Link } from "react-router-dom";
import { useAuth } from "../../context/auth_context";
import { useTheme } from "../../context/theme_context";

function UserCard() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const displayName = user?.full_name || user?.name || user?.email?.split("@")[0] || "Team member";
  const initials = user?.initials || displayName?.charAt(0)?.toUpperCase() || "T";
  const roleLabel = user?.role || user?.position || "Employee";

  return (
    <div
      className={`rounded-2xl border p-5 ${
        isDark
          ? "border-slate-800 bg-slate-900 shadow-lg shadow-slate-950/20"
          : "border-slate-200 bg-slate-50 shadow-sm"
      }`}
    >
      <div className="flex items-center gap-4">
        <Link
          to="/profile"
          aria-label={`Open ${displayName} profile`}
          className={`flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border ${
            isDark ? "border-slate-700 bg-slate-950" : "border-slate-200 bg-white"
          }`}
        >
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt={displayName} className="h-full w-full object-cover" />
          ) : (
            <span className={`text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-700"}`}>
              {initials}
            </span>
          )}
        </Link>
        <div className="min-w-0">
          <Link to="/profile" className={`block cursor-pointer truncate text-sm font-semibold transition ${isDark ? "text-slate-100 hover:text-sky-300" : "text-slate-900 hover:text-[#c446ff]"}`}>
            {displayName}
          </Link>
          <p className={`truncate text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            {user?.email || "user@company.com"}
          </p>
          <p className={`mt-1 text-xs ${isDark ? "text-slate-500" : "text-slate-600"}`}>
            {roleLabel}
          </p>
        </div>
      </div>
    </div>
  );
}

export default UserCard;
