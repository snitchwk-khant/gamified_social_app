import MenuItem from "./menu_item";
import Logo from "./logo";
import UserCard from "./user_card";
import UserSearch from "../user_search/user_search";
import { useAuth } from "../../context/auth_context";
import { useTheme } from "../../context/theme_context";

function LeftSidebar() {
  const { user } = useAuth();
  const { isDark } = useTheme();
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
        <div className="mt-4">
          <UserSearch />
        </div>
        <nav className="mt-4 space-y-3">
          <MenuItem to="/" icon="🏠" title="Home" />
          <MenuItem to="/notifications" icon="🔔" title="Notifications" />
          <MenuItem to="/profile" icon="👤" title="Profile" />
          {isAdmin ? <MenuItem to="/admin" icon="🛡️" title="Admin" /> : null}
        </nav>
      </div>
      <UserCard />
    </div>
  );
}

export default LeftSidebar;
