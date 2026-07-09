import MenuItem from "./menu_item";
import Logo from "./logo";
import UserSearch from "../user_search/user_search";
import { useAuth } from "../../context/auth_context";
import { useTheme } from "../../context/theme_context";
import { useEffect, useState } from "react";
import { subscribeToUnreadNotificationCount } from "../../services/notifications_service";
import homeSvg from "../../assets/icons/home.svg?raw";
import leaderboardSvg from "../../assets/icons/leaderboard.svg?raw";
import messagesSvg from "../../assets/icons/messages.svg?raw";
import notificationsSvg from "../../assets/icons/notifications.svg?raw";
import profileSvg from "../../assets/icons/profile.svg?raw";
import shopsSvg from "../../assets/icons/shops.svg?raw";

function SidebarSvgIcon({ label, svg }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-7 w-7 items-center justify-center leading-none [&_svg]:block [&_svg]:h-full [&_svg]:w-full"
      data-sidebar-icon={label}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function SidebarProfileIcon({ user }) {
  const displayName = user?.full_name || user?.name || user?.email?.split("@")[0] || "Team member";

  if (user?.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-7 w-7 rounded-full object-cover"
      />
    );
  }

  return (
    <span
      aria-label={displayName}
      className="inline-flex h-7 w-7 items-center justify-center leading-none [&_svg]:block [&_svg]:h-full [&_svg]:w-full"
      data-sidebar-icon="Profile fallback"
      dangerouslySetInnerHTML={{ __html: profileSvg }}
    />
  );
}

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
      className={`flex h-full w-full flex-col justify-between overflow-hidden rounded-2xl border p-4 ${
        isDark
          ? "border-slate-800 bg-slate-950 text-slate-100 shadow-2xl shadow-slate-950/30"
          : "border-slate-200 bg-white text-slate-800 shadow-sm"
      }`}
    >
      <div>
        <Logo />
        <nav className="mt-6 space-y-1.5">
          <MenuItem to="/home" icon={<SidebarSvgIcon label="Home" svg={homeSvg} />} title="Home" />
          <MenuItem to="/leaderboard" icon={<SidebarSvgIcon label="Leaderboard" svg={leaderboardSvg} />} title="Leaderboard" />
          <MenuItem to="/anonymous-mailbox" icon={<SidebarSvgIcon label="Messages" svg={messagesSvg} />} title="Messages" />
          <MenuItem to="/notifications" icon={<SidebarSvgIcon label="Notifications" svg={notificationsSvg} />} title="Notifications" badge={unreadNotifications} />
          <MenuItem to="/shops" icon={<SidebarSvgIcon label="Shops" svg={shopsSvg} />} title="Shops" />
          <MenuItem to="/profile" icon={<SidebarProfileIcon user={user} />} title="Profile" />
        </nav>
      </div>
      <div className="space-y-4">
        <div>
          <UserSearch />
        </div>
        {canViewAdminLinks ? (
          <div>
            <p className={`px-4 text-xs font-semibold uppercase tracking-[0.24em] ${isDark ? "text-slate-500" : "text-slate-400"}`}>
              Admin
            </p>
            <nav className="mt-3 space-y-1.5">
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
