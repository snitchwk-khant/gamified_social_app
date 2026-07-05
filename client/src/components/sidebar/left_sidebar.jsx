import MenuItem from "./menu_item";
import Logo from "./logo";
import UserSearch from "../user_search/user_search";
import { useAuth } from "../../context/auth_context";
import { useTheme } from "../../context/theme_context";
import { useEffect, useState } from "react";
import { subscribeToUnreadNotificationCount } from "../../services/notifications_service";

function LeftSidebar() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const role = user?.role?.toString().trim().toLowerCase();
  const canViewAdminLinks = role === "admin" || role === "accountant";

  useEffect(() => {
    if (!user?.id) {
      setUnreadNotifications(0);
      return undefined;
    }

    return subscribeToUnreadNotificationCount(setUnreadNotifications);
  }, [user?.id]);

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
          <MenuItem to="/notifications" icon="🔔" title="Notifications" badge={unreadNotifications} />
          <MenuItem to="/anonymous-mailbox" icon="📬" title="Mailbox" />
          <MenuItem to="/leaderboard" icon="🏆" title="Leaderboard" />
          <MenuItem to="/monthly-champions" icon="👑" title="Champions" />
          <MenuItem to="/individual-ranking" icon="👤" title="Soft Skill Ranking" />
          <MenuItem to="/shops" icon="🏪" title="Shops" />
          <MenuItem to="/profile" icon="👤" title="Profile" />
        </nav>
      </div>
      <div className="space-y-4">
        {canViewAdminLinks ? (
          <div>
            <p className={`px-4 text-xs font-semibold uppercase tracking-[0.24em] ${isDark ? "text-slate-500" : "text-slate-400"}`}>
              Admin
            </p>
            <nav className="mt-3 space-y-3">
              <MenuItem to="/admin/sales-targets" icon="📊" title="Sales Targets" />
              <MenuItem to="/admin/announcements" icon="📢" title="Announcements" />
              <MenuItem to="/admin/anonymous-mailbox" icon="📬" title="Mailbox" />
            </nav>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default LeftSidebar;
