import { useTheme } from "../../context/theme_context";
import { NavLink } from "react-router-dom";

const MOBILE_NAV_ITEMS = [
  { label: "Home", icon: "🏠", to: "/" },
  { label: "Leaderboard", icon: "🏆", to: "/leaderboard" },
  { label: "Messages", icon: "📬", to: "/anonymous-mailbox" },
  { label: "Profile", icon: "👤", to: "/profile" },
];

function DesktopLayout({ left, center, right }) {
  const { isDark } = useTheme();

  return (
    <div className={`min-h-screen overflow-x-hidden ${isDark ? "bg-slate-950 text-slate-100" : "bg-[#f0f2f5] text-slate-800"}`}>
      <div className="mx-auto grid min-h-screen w-full max-w-[1460px] grid-cols-1 gap-5 overflow-visible px-3 pb-24 pt-3 sm:px-4 sm:pt-4 xl:h-screen xl:grid-cols-[280px_minmax(0,1fr)_320px] xl:overflow-hidden xl:px-6 xl:pb-4">
        <aside className="hidden min-h-0 flex-col gap-6 xl:flex">
          {left}
        </aside>

        <main
          className={`min-h-0 overflow-hidden rounded-2xl border p-3 sm:p-4 xl:p-5 ${
            isDark
              ? "border-slate-800 bg-slate-950 shadow-2xl shadow-slate-950/30"
              : "border-slate-200 bg-white shadow-sm"
          }`}
        >
          {center}
        </main>

        <aside className="hidden min-h-0 flex-col gap-5 xl:flex">
          {right}
        </aside>
      </div>

      <nav
        className={`fixed inset-x-0 bottom-0 z-50 border-t px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur-xl xl:hidden ${
          isDark ? "border-white/10 bg-slate-950/90" : "border-slate-200 bg-white/90"
        }`}
      >
        <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
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
    </div>
  );
}

export default DesktopLayout;
