import AdminPlaceholderPage from "../pages/admin_placeholder_page";
import AdminUsersPage from "../pages/admin_users_page";

export const adminRoutes = [
  {
    path: "dashboard",
    label: "Dashboard",
    title: "Dashboard",
    icon: "dashboard",
  },
  {
    path: "users",
    label: "Users",
    title: "Users",
    icon: "users",
  },
  {
    path: "posts",
    label: "Posts",
    title: "Posts",
    icon: "posts",
  },
  {
    path: "stories",
    label: "Stories",
    title: "Stories",
    icon: "stories",
  },
  {
    path: "reports",
    label: "Reports",
    title: "Reports",
    icon: "reports",
  },
  {
    path: "settings",
    label: "Settings",
    title: "Settings",
    icon: "settings",
  },
];

export function createAdminRouteElement(route) {
  if (route.path === "users") {
    return <AdminUsersPage />;
  }

  return <AdminPlaceholderPage title={route.title} />;
}
