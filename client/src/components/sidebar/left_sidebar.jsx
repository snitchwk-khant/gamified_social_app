import MenuItem from "./menu_item";
import Logo from "./logo";
import UserCard from "./user_card";
import { useAuth } from "../../context/auth_context";
import { useTheme } from "../../context/theme_context";

function LeftSidebar() {
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const isAdmin = user?.role?.toString().trim().toLowerCase() === "admin";

  return (
    <div
      className={`flex h-full flex-col justify-between rounded-2xl border p-5 ${
        isDark
          ? "border-slate-800 bg-slate-950 text-slate-100 shadow-2xl shadow-slate-950/30"
          : "border-slate-200 bg-white text-slate-800 shadow-sm"
      }`}
    >
      <div>
        <Logo />
        <nav className="mt-10 space-y-3">
          <MenuItem to="/" icon="🏠" title="Home" />
          <MenuItem to="/notifications" icon="🔔" title="Notifications" />
          <MenuItem to="/profile" icon="👤" title="Profile" />
          <SidebarAction
            icon={isDark ? "☀️" : "🌙"}
            title={isDark ? "Light mode" : "Dark mode"}
            onClick={toggleTheme}
          />
          {isAdmin ? <MenuItem to="/admin" icon="🛡️" title="Admin" /> : null}
        </nav>
      </div>
      <UserCard />
    </div>
  );
}

function SidebarAction({ icon, title, onClick }) {
  const { isDark } = useTheme();

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-4 rounded-2xl px-4 py-3 text-left text-sm font-medium transition-colors duration-200 ${
        isDark
          ? "text-slate-300 hover:bg-slate-900 hover:text-white"
          : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      <span className="text-xl">{icon}</span>
      <span>{title}</span>
    </button>
  );
}

export default LeftSidebar;
