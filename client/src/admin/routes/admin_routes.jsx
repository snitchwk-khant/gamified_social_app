import AdminDashboardContent from "../components/admin_dashboard_content";
import AdminRouteGate from "../components/admin_route_gate";
import AdminPlaceholderPage from "../pages/admin_placeholder_page";
import AdminUsersPage from "../pages/admin_users_page";
import AnnouncementsPage from "../pages/announcements_page";
import SalesTargetsPage from "../pages/sales_targets_page";

export const adminRoutes = [
  {
    path: "dashboard",
    label: "Dashboard",
    title: "Dashboard",
    icon: "dashboard",
    allowedRoles: ["admin", "accountant"],
  },
  {
    path: "users",
    label: "Users",
    title: "Users",
    icon: "users",
    allowedRoles: ["admin"],
  },
  {
    path: "sales-targets",
    label: "Sales Targets",
    title: "Sales Targets",
    icon: "sales",
    allowedRoles: ["admin", "accountant"],
  },
  {
    path: "announcements",
    label: "Announcements",
    title: "Announcements",
    icon: "announcements",
    allowedRoles: ["admin", "accountant"],
  },
  {
    path: "posts",
    label: "Posts",
    title: "Posts",
    icon: "posts",
    allowedRoles: ["admin"],
  },
  {
    path: "stories",
    label: "Stories",
    title: "Stories",
    icon: "stories",
    allowedRoles: ["admin"],
  },
  {
    path: "reports",
    label: "Reports",
    title: "Reports",
    icon: "reports",
    allowedRoles: ["admin"],
  },
  {
    path: "settings",
    label: "Settings",
    title: "Settings",
    icon: "settings",
    allowedRoles: ["admin"],
  },
];

export function createAdminRouteElement(route) {
  let page = <AdminPlaceholderPage title={route.title} />;

  if (route.path === "dashboard") {
    page = <AdminDashboardContent />;
  }

  if (route.path === "users") {
    page = <AdminUsersPage />;
  }

  if (route.path === "sales-targets") {
    page = <SalesTargetsPage />;
  }

  if (route.path === "announcements") {
    page = <AnnouncementsPage />;
  }

  return <AdminRouteGate route={route}>{page}</AdminRouteGate>;
}
