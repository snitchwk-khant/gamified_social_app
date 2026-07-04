import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/auth_context";
import { adminRoutes } from "../routes/admin_routes";

const iconPaths = {
  dashboard: "M4 13h6V4H4v9Zm10 7h6V4h-6v16ZM4 20h6v-5H4v5Zm10 0h6v-5h-6v5Z",
  users:
    "M16 11a4 4 0 1 0-3.46-6A4 4 0 0 0 16 11ZM8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4ZM8 14c-3.12 0-8 1.57-8 4v2h6v-2c0-1.48.8-2.8 2.2-3.92L8 14Z",
  posts:
    "M5 4h14a2 2 0 0 1 2 2v13.2a.8.8 0 0 1-1.28.64L16 17H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm2 4v2h10V8H7Zm0 4v2h7v-2H7Z",
  stories:
    "M12 2 3 6v6c0 5.25 3.84 8.74 9 10 5.16-1.26 9-4.75 9-10V6l-9-4Zm0 4.1 5 2.22V12c0 3.28-1.9 5.56-5 6.65-3.1-1.09-5-3.37-5-6.65V8.32l5-2.22Z",
  sales:
    "M4 5h16v14H4V5Zm2 2v10h12V7H6Zm2 2h3v2H8V9Zm0 4h8v2H8v-2Zm5-4h3v2h-3V9Z",
  announcements:
    "M4 10v4h3l5 4V6l-5 4H4Zm10-3.2v10.4c2.33-.82 4-3.04 4-5.2s-1.67-4.38-4-5.2ZM20 12c0 3.31-2.03 6.15-4.91 7.34l-.78-1.84A6 6 0 0 0 18 12a6 6 0 0 0-3.69-5.5l.78-1.84A8 8 0 0 1 20 12Z",
  notifications:
    "M12 22a2.75 2.75 0 0 0 2.65-2h-5.3A2.75 2.75 0 0 0 12 22Zm7-6V11a7 7 0 1 0-14 0v5l-2 2v1h18v-1l-2-2Zm-2 .2.8.8H6.2l.8-.8V11a5 5 0 1 1 10 0v5.2Z",
  mailbox:
    "M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm0 3.2V17h16V8.2l-7.4 5.18a1 1 0 0 1-1.15 0L4 8.2Zm1.2-1.2L12 11.76 18.8 7H5.2Z",
  reports:
    "M5 3h10l4 4v14H5V3Zm9 1.5V8h3.5L14 4.5ZM8 12v2h8v-2H8Zm0 4v2h8v-2H8Zm0-8v2h4V8H8Z",
  settings:
    "M19.43 12.98c.04-.32.07-.65.07-.98s-.02-.66-.07-.98l2.11-1.65-2-3.46-2.49 1a7.17 7.17 0 0 0-1.69-.98L15 3.25h-4l-.36 2.68c-.6.23-1.16.56-1.69.98l-2.49-1-2 3.46 2.11 1.65a7.93 7.93 0 0 0 0 1.96l-2.11 1.65 2 3.46 2.49-1c.52.4 1.09.74 1.69.98L11 20.75h4l.36-2.68c.6-.24 1.17-.58 1.69-.98l2.49 1 2-3.46-2.11-1.65ZM13 15.5A3.5 3.5 0 1 1 13 8a3.5 3.5 0 0 1 0 7.5Z",
};

function AdminIcon({ name }) {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d={iconPaths[name]} />
    </svg>
  );
}

function AdminSidebar({ isOpen, onClose }) {
  const { user } = useAuth();
  const location = useLocation();
  const role = user?.role?.toString().trim().toLowerCase() || "employee";
  const roleLabel = role === "accountant" ? "Accountant" : "Admin";
  const visibleRoutes = adminRoutes.filter((item) => item.allowedRoles.includes(role) && !item.hideFromSidebar);

  const navLinkClass = (isActive) =>
    `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
      isActive
        ? "bg-[#f6e8ff] text-[#c446ff]"
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
    }`;

  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-slate-950/30 transition lg:hidden ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200 bg-white p-5 transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#c446ff]">{roleLabel}</p>
            <h1 className="mt-1 text-xl font-bold text-slate-950">Gemify</h1>
          </div>
          <button
            type="button"
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            onClick={onClose}
            aria-label="Close admin menu"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M6.4 5 5 6.4l5.6 5.6L5 17.6 6.4 19l5.6-5.6 5.6 5.6 1.4-1.4-5.6-5.6L19 6.4 17.6 5 12 10.6 6.4 5Z" />
            </svg>
          </button>
        </div>

        <nav className="mt-8 space-y-2">
          {visibleRoutes.map((item) => {
            const itemPath = `/admin/${item.path}`;
            const isActive =
              location.pathname === itemPath || (item.path === "dashboard" && location.pathname === "/admin");

            return (
              <Link key={item.path} to={itemPath} className={navLinkClass(isActive)} onClick={onClose}>
                <AdminIcon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

export default AdminSidebar;
