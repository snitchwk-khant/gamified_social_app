import { useAuth } from "../../context/auth_context";
import AdminPlaceholderPage from "../pages/admin_placeholder_page";

function normalizeRole(role) {
  return role?.toString().trim().toLowerCase() || "employee";
}

function AdminDashboardContent() {
  const { user } = useAuth();
  const role = normalizeRole(user?.role);

  if (role === "accountant") {
    return (
      <AdminPlaceholderPage title="Accountant Dashboard">
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm font-semibold text-slate-950">Sales Targets</p>
          <p className="mt-1 text-sm text-slate-500">(Coming Soon)</p>
        </div>
      </AdminPlaceholderPage>
    );
  }

  return <AdminPlaceholderPage title="Dashboard" />;
}

export default AdminDashboardContent;
