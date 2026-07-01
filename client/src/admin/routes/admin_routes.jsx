import { Navigate } from "react-router-dom";
import AdminDashboardContent from "../components/admin_dashboard_content";
import AdminRouteGate from "../components/admin_route_gate";
import AdminPlaceholderPage from "../pages/admin_placeholder_page";
import AdminUsersPage from "../pages/admin_users_page";
import AnnouncementsPage from "../pages/announcements_page";
import LeaderboardSettingsPage from "../pages/leaderboard_settings_page";
import SalesTargetsPage from "../pages/sales_targets_page";
import ShopHistoryPage from "../pages/shop_history_page";

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
    redirectTo: "/admin/sales-targets/employees",
    hideFromSidebar: true,
  },
  {
    path: "sales-targets/employees",
    label: "Employee Targets",
    title: "Employee Targets",
    icon: "sales",
    allowedRoles: ["admin", "accountant"],
  },
  {
    path: "sales-targets/shops",
    label: "Shop Targets",
    title: "Shop Targets",
    icon: "sales",
    allowedRoles: ["admin", "accountant"],
  },
  {
    path: "manage-shops",
    label: "Manage Shops",
    title: "Manage Shops",
    icon: "sales",
    allowedRoles: ["admin", "accountant"],
  },
  {
    path: "shop-history",
    label: "Shop History",
    title: "Shop History",
    icon: "reports",
    allowedRoles: ["admin", "accountant"],
  },
  {
    path: "leaderboard-settings",
    label: "Leaderboard Settings",
    title: "Leaderboard Settings",
    icon: "settings",
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

  if (route.redirectTo) {
    page = <Navigate to={route.redirectTo} replace />;
  }

  if (route.path === "dashboard") {
    page = <AdminDashboardContent />;
  }

  if (route.path === "users") {
    page = <AdminUsersPage />;
  }

  if (route.path === "sales-targets/employees") {
    page = <SalesTargetsPage mode="employees" />;
  }

  if (route.path === "sales-targets/shops") {
    page = <SalesTargetsPage mode="shops" />;
  }

  if (route.path === "manage-shops") {
    page = <SalesTargetsPage mode="manage-shops" />;
  }

  if (route.path === "shop-history") {
    page = <ShopHistoryPage />;
  }

  if (route.path === "leaderboard-settings") {
    page = <LeaderboardSettingsPage />;
  }

  if (route.path === "announcements") {
    page = <AnnouncementsPage />;
  }

  return <AdminRouteGate route={route}>{page}</AdminRouteGate>;
}
