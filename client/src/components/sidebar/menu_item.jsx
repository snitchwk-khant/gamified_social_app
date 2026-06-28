import { NavLink } from "react-router-dom";
import { useTheme } from "../../context/theme_context";

function MenuItem({ icon, title, to }) {
  const { isDark } = useTheme();

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
      <span>{title}</span>
    </NavLink>
  );
}

export default MenuItem;
