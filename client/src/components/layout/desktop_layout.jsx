import { useTheme } from "../../context/theme_context";
import { NavLink, useNavigate } from "react-router-dom";

const MOBILE_NAV_ITEMS = [
  { label: "Search", icon: "⌕", href: "#mobile-user-search" },
  { label: "Home", icon: "⌂", to: "/" },
  { label: "Story", icon: "+", action: "open-story-composer", primary: true },
  { label: "Messages", icon: "💬", to: "/notifications" },
  { label: "Profile", icon: "○", to: "/profile" },
];

function DesktopLayout({ left, center, right }) {
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const handleMobileNavAction = (item) => {
    if (item.action !== "open-story-composer") {
      return;
    }

    window.sessionStorage.setItem("openStoryComposer", "true");
    window.dispatchEvent(new CustomEvent("gemify:open-story-composer"));
    navigate("/");
  };

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
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          {MOBILE_NAV_ITEMS.map((item) =>
            item.to ? (
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
            ) : item.action ? (
              <button
                key={item.label}
                type="button"
                onClick={() => handleMobileNavAction(item)}
                className={
                  item.primary
                    ? "flex min-h-14 -translate-y-2 flex-col items-center justify-center px-1 text-[11px] font-semibold text-[#c446ff] transition active:translate-y-0 active:scale-95"
                    : `flex min-h-14 flex-col items-center justify-center rounded-2xl px-1 text-[11px] font-semibold transition ${
                        isDark ? "text-slate-300 hover:bg-slate-900" : "text-slate-600 hover:bg-slate-100"
                      }`
                }
              >
                <span
                  className={
                    item.primary
                      ? "flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#c446ff] to-violet-600 text-3xl font-light leading-none text-white shadow-lg shadow-fuchsia-950/30"
                      : "text-lg leading-none"
                  }
                >
                  {item.icon}
                </span>
                <span className="mt-1 truncate">{item.label}</span>
              </button>
            ) : (
              <a
                key={item.label}
                href={item.href}
                className={`flex min-h-14 flex-col items-center justify-center rounded-2xl px-1 text-[11px] font-semibold transition ${
                  isDark ? "text-slate-300 hover:bg-slate-900" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span className="text-lg leading-none">{item.icon}</span>
                <span className="mt-1 truncate">{item.label}</span>
              </a>
            )
          )}
        </div>
      </nav>
    </div>
  );
}

export default DesktopLayout;
