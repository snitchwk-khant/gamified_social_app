import { NavLink } from "react-router-dom";
import { useTheme } from "../../context/theme_context";

function MenuItem({ icon, title, to, badge = 0 }) {
  const { isDark } = useTheme();
  const normalizedBadge = Number(badge) || 0;

  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `group/menu flex min-h-12 items-center gap-4 rounded-xl px-3 py-2.5 text-[15px] font-semibold transition-colors duration-200 ${
          isActive
            ? isDark
              ? "bg-white/10 text-white"
              : "bg-[#f6e8ff] text-[#c446ff]"
            : isDark
              ? "text-slate-300 hover:bg-white/5 hover:text-white"
              : "text-slate-700 hover:bg-slate-100/80 hover:text-slate-950"
        }`
      }
    >
      <span className="w-7 text-center text-2xl leading-none transition-transform duration-200 group-hover/menu:scale-105">{icon}</span>
      <span className="min-w-0 flex-1 truncate">
        {title}
      </span>
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
