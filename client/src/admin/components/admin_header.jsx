import { useAuth } from "../../context/auth_context";

function AdminHeader({ onMenuClick }) {
  const { user } = useAuth();
  const displayName = user?.full_name || user?.name || user?.email?.split("@")[0] || "Admin";
  const initials = user?.initials || displayName.charAt(0).toUpperCase();
  const role = user?.role?.toString().trim().toLowerCase();
  const roleLabel = role === "accountant" ? "Accountant" : "Admin";

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-[#f8fafc]/90 px-4 py-4 backdrop-blur md:px-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-full border border-slate-200 bg-white p-2 text-slate-600 shadow-sm lg:hidden"
            onClick={onMenuClick}
            aria-label="Open admin menu"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M4 6h16v2H4V6Zm0 5h16v2H4v-2Zm0 5h16v2H4v-2Z" />
            </svg>
          </button>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#c446ff]">Workspace</p>
            <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">{roleLabel} Dashboard</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm"
            aria-label="Notifications"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M12 22a2.4 2.4 0 0 0 2.33-1.82H9.67A2.4 2.4 0 0 0 12 22Zm7-6-2-2v-4.5A5 5 0 0 0 13 4.6V3h-2v1.6a5 5 0 0 0-4 4.9V14l-2 2v1h14v-1Z" />
            </svg>
          </button>

          <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3 shadow-sm">
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#f6e8ff] text-sm font-bold text-[#c446ff]">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="hidden min-w-0 sm:block">
              <p className="max-w-[150px] truncate text-sm font-semibold text-slate-950">{displayName}</p>
              <p className="text-xs text-slate-500">{roleLabel}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default AdminHeader;
