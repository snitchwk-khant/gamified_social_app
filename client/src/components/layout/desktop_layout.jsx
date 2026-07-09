import { useEffect, useState } from "react";
import { FiAward, FiBell, FiHome, FiMail, FiUser } from "react-icons/fi";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../context/auth_context";
import SafeAreaLayout from "./SafeAreaLayout";
import { useTheme } from "../../context/theme_context";
import { subscribeToUnreadNotificationCount } from "../../services/notifications_service";

const MOBILE_NAV_ITEMS = [
  { label: "Home", icon: FiHome, to: "/home" },
  { label: "Leaderboard", icon: FiAward, to: "/leaderboard" },
  { label: "Notifications", icon: FiBell, to: "/notifications", badge: "notifications" },
  { label: "Messages", icon: FiMail, to: "/anonymous-mailbox" },
  { label: "Profile", icon: FiUser, to: "/profile" },
];

const MOBILE_TAB_SCROLL_PREFIX = "gemify-mobile-tab-scroll:";

function getRouteScrollKey(pathname, search) {
  return `${pathname || "/"}${search || ""}`;
}

function isMobileViewport() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  return window.matchMedia("(max-width: 1279px)").matches;
}

function saveMobileTabScroll(location) {
  if (typeof window === "undefined" || !isMobileViewport()) {
    return;
  }

  try {
    window.sessionStorage.setItem(
      `${MOBILE_TAB_SCROLL_PREFIX}${getRouteScrollKey(location.pathname, location.search)}`,
      String(window.scrollY || document.documentElement.scrollTop || 0)
    );
  } catch (error) {
    console.error("Unable to save mobile tab scroll:", error);
  }
}

function MobileBottomNavigation() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(isMobileViewport);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(max-width: 1279px)");
    const handleChange = () => setIsMobile(mediaQuery.matches);

    handleChange();
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  useEffect(() => {
    if (!isMobile || !user?.id) {
      setUnreadNotifications(0);
      return undefined;
    }

    return subscribeToUnreadNotificationCount(setUnreadNotifications);
  }, [isMobile, user?.id]);

  useEffect(() => {
    if (!isMobileViewport()) {
      return undefined;
    }

    let animationFrame = 0;

    try {
      const savedScroll = window.sessionStorage.getItem(
        `${MOBILE_TAB_SCROLL_PREFIX}${getRouteScrollKey(location.pathname, location.search)}`
      );

      if (savedScroll !== null) {
        const nextScroll = Number(savedScroll);

        if (Number.isFinite(nextScroll)) {
          animationFrame = window.requestAnimationFrame(() => {
            window.scrollTo({ top: nextScroll, left: 0, behavior: "auto" });
          });
        }
      }
    } catch (error) {
      console.error("Unable to restore mobile tab scroll:", error);
    }

    return () => {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, [location.pathname, location.search]);

  const formattedUnreadNotifications = unreadNotifications > 99 ? "99+" : unreadNotifications;

  if (!isMobile) {
    return null;
  }

  return (
    <nav
      className={`fixed inset-x-3 bottom-[calc(max(var(--safe-area-inset-bottom),0px)+0.75rem)] z-50 mx-auto max-w-md rounded-full border px-2 py-2 shadow-2xl backdrop-blur-2xl transition-colors duration-200 xl:hidden ${
        isDark ? "border-white/10 bg-slate-950/70 shadow-slate-950/45" : "border-white/70 bg-white/70 shadow-slate-900/15"
      }`}
      aria-label="Primary mobile navigation"
    >
      <div className="grid grid-cols-5 gap-1">
        {MOBILE_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const badge = item.badge === "notifications" ? unreadNotifications : 0;

          return (
            <NavLink
              key={item.label}
              to={item.to}
              onClick={() => saveMobileTabScroll(location)}
              className={({ isActive }) =>
                `relative flex min-h-14 flex-col items-center justify-center rounded-2xl px-1 text-[9px] font-semibold transition duration-200 ease-out ${
                  isActive
                    ? isDark
                      ? "bg-sky-500 text-slate-950 shadow-lg shadow-sky-500/20"
                      : "bg-[#f6e8ff] text-[#c446ff] shadow-lg shadow-[#c446ff]/10"
                    : isDark
                      ? "text-slate-300 hover:bg-slate-900 hover:text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                }`
              }
            >
              <span className="relative grid h-6 w-6 place-items-center">
                <Icon className="h-5 w-5" aria-hidden="true" />
                {badge > 0 ? (
                  <span className="absolute -right-2 -top-2 min-w-5 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-black leading-none text-white shadow-lg shadow-rose-500/25">
                    {formattedUnreadNotifications}
                  </span>
                ) : null}
              </span>
              <span className="mt-1 max-w-full truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

function DesktopLayout({
  left,
  center,
  right,
  isHomeRoute = false,
  isShopsRoute = false,
  isNotificationsRoute = false,
  isLeaderboardRoute = false,
  isProfileRoute = false,
  isMessagesRoute = false,
}) {
  const { isDark } = useTheme();
  const hasDesktopSidebar =
    isHomeRoute || isShopsRoute || isNotificationsRoute || isLeaderboardRoute || isProfileRoute || isMessagesRoute;
  const usesWideSidebarLayout = isShopsRoute || isNotificationsRoute || isLeaderboardRoute || isProfileRoute || isMessagesRoute;

  return (
    <SafeAreaLayout className={`min-h-screen overflow-x-hidden ${isDark ? "bg-slate-950 text-slate-100" : "bg-[#f0f2f5] text-slate-800"}`}>
      <div
        className={`mx-auto grid min-h-screen w-full grid-cols-1 gap-5 overflow-visible px-3 pb-[calc(6.5rem+var(--safe-area-inset-bottom))] pt-3 sm:px-4 sm:pt-4 ${
          isHomeRoute
            ? "xl:h-screen xl:max-w-[1600px] xl:grid-cols-[320px_minmax(0,760px)_320px] xl:justify-center xl:gap-6 xl:overflow-hidden xl:px-0 xl:pb-4 xl:pt-4"
            : usesWideSidebarLayout
              ? "xl:max-w-[1600px] xl:grid-cols-[320px_minmax(0,1fr)] xl:justify-center xl:gap-6 xl:px-6 xl:pb-6 xl:pt-6"
            : "xl:h-screen xl:overflow-hidden xl:px-6 xl:pb-4"
        }`}
      >
        <aside
          className={
            hasDesktopSidebar
              ? `hidden xl:sticky xl:col-start-1 xl:row-start-1 xl:block xl:min-w-0 xl:overflow-hidden ${
                  usesWideSidebarLayout ? "xl:top-6 xl:h-[calc(100vh-3rem)]" : "xl:top-4 xl:h-[calc(100vh-2rem)]"
                }`
              : "hidden"
          }
        >
          {left}
        </aside>

        <main
          className={`min-h-0 overflow-hidden rounded-2xl border p-3 sm:p-4 xl:col-start-2 xl:row-start-1 xl:min-w-0 xl:w-full ${
            isDark
              ? "border-slate-800 bg-slate-950 shadow-2xl shadow-slate-950/30"
              : "border-slate-200 bg-white shadow-sm"
          } ${
            isHomeRoute
              ? isDark
                ? "xl:rounded-none xl:border-0 xl:bg-transparent xl:p-0 xl:shadow-none"
                : "xl:rounded-none xl:border-0 xl:bg-transparent xl:p-0 xl:shadow-none"
              : usesWideSidebarLayout
                ? "xl:rounded-none xl:border-0 xl:bg-transparent xl:p-0 xl:shadow-none"
              : "xl:p-4"
          }`}
        >
          {center}
        </main>

        <aside className={isHomeRoute ? "hidden xl:sticky xl:top-4 xl:col-start-3 xl:row-start-1 xl:block xl:h-[calc(100vh-2rem)] xl:min-w-0 xl:overflow-y-auto" : "hidden"}>
          {right}
        </aside>
      </div>

      <MobileBottomNavigation />
    </SafeAreaLayout>
  );
}

export default DesktopLayout;
