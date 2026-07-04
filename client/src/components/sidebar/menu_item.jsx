import { NavLink } from "react-router-dom";
import { useTheme } from "../../context/theme_context";

function MenuItem({ icon, title, to, badge = 0 }) {
  const { isDark } = useTheme();
  const normalizedBadge = Number(badge) || 0;

  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-4 rounded-2xl px-4 py-3 text-sm font-medium transition-colors duration-200 ${
          isActive
            ? isDark
              ? "bg-sky-600 text-white"
              : "bg-[#f6e8ff] text-[#c446ff]"
            : isDark
              ? "text-slate-300 hover:bg-slate-900 hover:text-white"
              : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
        }`
      }
    >
      <span className="text-xl">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{title}</span>
      {normalizedBadge > 0 ? (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
            isDark ? "bg-[#c446ff] text-white" : "bg-[#f6e8ff] text-[#c446ff]"
          }`}
        >
          {normalizedBadge > 99 ? "99+" : normalizedBadge}
        </span>
      ) : null}
    </NavLink>
  );
}

export default MenuItem;
