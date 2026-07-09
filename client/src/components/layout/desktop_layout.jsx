import { memo, useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../context/auth_context";
import SafeAreaLayout from "./SafeAreaLayout";
import { useTheme } from "../../context/theme_context";
import { subscribeToUnreadNotificationCount } from "../../services/notifications_service";
import homeSvg from "../../assets/icons/home.svg?raw";
import leaderboardSvg from "../../assets/icons/leaderboard.svg?raw";
import messagesSvg from "../../assets/icons/messages.svg?raw";
import notificationsSvg from "../../assets/icons/notifications.svg?raw";
import profileSvg from "../../assets/icons/profile.svg?raw";

const MOBILE_NAV_ITEMS = [
  { label: "Home", svg: homeSvg, to: "/home" },
  { label: "Leaderboard", svg: leaderboardSvg, to: "/leaderboard" },
  { label: "Notifications", svg: notificationsSvg, to: "/notifications", badge: "notifications" },
  { label: "Messages", svg: messagesSvg, to: "/anonymous-mailbox" },
  { label: "Profile", to: "/profile", avatar: true },
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

const MobileNavSvgIcon = memo(function MobileNavSvgIcon({ active = false, label, svg }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center leading-none transition duration-200 ease-out [&_svg]:block [&_svg]:h-full [&_svg]:w-full ${
        active ? "scale-105 opacity-100 brightness-110" : "scale-100 opacity-70 brightness-95"
      }`}
      data-mobile-nav-icon={label}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
});

const MobileProfileAvatar = memo(function MobileProfileAvatar({ active, user }) {
  const displayName = user?.full_name || user?.name || user?.email?.split("@")[0] || "Team member";
  const avatarStateClass = active ? "scale-105 opacity-100 brightness-110" : "scale-100 opacity-70 brightness-95";

  return (
    <span
      className={`grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full transition duration-200 ease-out ${avatarStateClass}`}
    >
      {user?.avatar_url ? (
        <img
          src={user.avatar_url}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <span
          aria-label={displayName}
          className="inline-flex h-8 w-8 items-center justify-center [&_svg]:block [&_svg]:h-full [&_svg]:w-full"
          data-mobile-nav-icon="Profile fallback"
          dangerouslySetInnerHTML={{ __html: profileSvg }}
        />
      )}
    </span>
  );
});

function MobileBottomNavigation() {
  const { user } = useAuth();
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
      className="fixed inset-x-0 bottom-[calc(max(var(--safe-area-inset-bottom),0px)+0.875rem)] z-50 mx-auto h-12 px-5 xl:hidden"
      aria-label="Primary mobile navigation"
    >
      <div className="mx-auto grid h-full max-w-md grid-cols-5 items-center gap-1">
        {MOBILE_NAV_ITEMS.map((item) => {
          const badge = item.badge === "notifications" ? unreadNotifications : 0;

          return (
            <NavLink
              key={item.label}
              to={item.to}
              aria-label={item.label}
              title={item.label}
              onClick={() => saveMobileTabScroll(location)}
              className={({ isActive }) =>
                `relative flex h-12 w-full items-center justify-center px-1 transition duration-200 ease-out ${
                  isActive ? "" : "hover:opacity-100"
                }`
              }
            >
              {({ isActive }) => (
                <span className="relative grid h-9 w-9 place-items-center">
                  {item.avatar ? (
                    <MobileProfileAvatar active={isActive} user={user} />
                  ) : (
                    <MobileNavSvgIcon
                      active={isActive}
                      label={item.label}
                      svg={item.svg}
                    />
                  )}
                  {badge > 0 ? (
                    <span className="absolute -right-2 -top-2 min-w-5 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-black leading-none text-white shadow-lg shadow-rose-500/25">
                      {formattedUnreadNotifications}
                    </span>
                  ) : null}
                </span>
              )}
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
        className={`mx-auto grid min-h-screen w-full grid-cols-1 overflow-visible pb-[calc(6.5rem+var(--safe-area-inset-bottom))] ${
          isHomeRoute
            ? "gap-0 px-0 pt-0 sm:gap-5 sm:px-4 sm:pt-4 xl:h-screen xl:max-w-[1600px] xl:grid-cols-[320px_minmax(0,760px)_320px] xl:justify-center xl:gap-6 xl:overflow-hidden xl:px-0 xl:pb-4 xl:pt-4"
            : usesWideSidebarLayout
              ? "gap-5 px-3 pt-3 sm:px-4 sm:pt-4 xl:max-w-[1600px] xl:grid-cols-[320px_minmax(0,1fr)] xl:justify-center xl:gap-6 xl:px-6 xl:pb-6 xl:pt-6"
            : "gap-5 px-3 pt-3 sm:px-4 sm:pt-4 xl:h-screen xl:overflow-hidden xl:px-6 xl:pb-4"
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
          className={`min-h-0 overflow-hidden xl:col-start-2 xl:row-start-1 xl:min-w-0 xl:w-full ${
            isHomeRoute
              ? isDark
                ? "border-0 bg-transparent p-0 shadow-none sm:rounded-2xl sm:border sm:border-slate-800 sm:bg-slate-950 sm:p-4 sm:shadow-2xl sm:shadow-slate-950/30 xl:rounded-none xl:border-0 xl:bg-transparent xl:p-0 xl:shadow-none"
                : "border-0 bg-transparent p-0 shadow-none sm:rounded-2xl sm:border sm:border-slate-200 sm:bg-white sm:p-4 sm:shadow-sm xl:rounded-none xl:border-0 xl:bg-transparent xl:p-0 xl:shadow-none"
              : usesWideSidebarLayout
                ? `${isDark ? "border-slate-800 bg-slate-950 shadow-2xl shadow-slate-950/30" : "border-slate-200 bg-white shadow-sm"} rounded-2xl border p-3 sm:p-4 xl:rounded-none xl:border-0 xl:bg-transparent xl:p-0 xl:shadow-none`
              : `${isDark ? "border-slate-800 bg-slate-950 shadow-2xl shadow-slate-950/30" : "border-slate-200 bg-white shadow-sm"} rounded-2xl border p-3 sm:p-4 xl:p-4`
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
