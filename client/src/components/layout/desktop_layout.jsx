import { useTheme } from "../../context/theme_context";
import { NavLink } from "react-router-dom";
import SafeAreaLayout from "./SafeAreaLayout";

const MOBILE_NAV_ITEMS = [
  { label: "Home", icon: "🏠", to: "/" },
  { label: "Leaderboard", icon: "🏆", to: "/leaderboard" },
  { label: "Messages", icon: "📬", to: "/anonymous-mailbox" },
  { label: "Profile", icon: "👤", to: "/profile" },
];

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

      <nav
        className={`fixed inset-x-3 bottom-[calc(max(var(--safe-area-inset-bottom),0px)+0.75rem)] z-50 mx-auto max-w-md rounded-full border px-2 py-2 shadow-2xl backdrop-blur-2xl xl:hidden ${
          isDark ? "border-white/10 bg-slate-950/55 shadow-slate-950/45" : "border-white/70 bg-white/55 shadow-slate-900/15"
        }`}
      >
        <div className="grid grid-cols-4 gap-1">
          {MOBILE_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center rounded-2xl px-1 text-[11px] font-semibold transition ${
                  isActive
                    ? isDark
                      ? "bg-sky-500 text-slate-950"
                      : "bg-[#f6e8ff] text-[#c446ff]"
                    : isDark
                      ? "text-slate-300 hover:bg-slate-900"
                      : "text-slate-600 hover:bg-slate-100"
                }`
              }
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span className="mt-1 truncate">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </SafeAreaLayout>
  );
}

export default DesktopLayout;
