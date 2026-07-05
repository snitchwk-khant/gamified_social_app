import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./context/auth_context";
import { SocketProvider } from "./context/socket_context";
import { ThemeProvider, useTheme } from "./context/theme_context";
import AdminLayout from "./admin/layouts/admin_layout";
import { adminRoutes, createAdminRouteElement } from "./admin/routes/admin_routes";
import MainLayout from "./layouts/main_layout";
import AnonymousMailboxPage from "./pages/anonymous_mailbox_page";
import HomePage from "./pages/home_page";
import LoginPage from "./pages/login_page";
import NotificationsPage from "./pages/notifications_page";
import ProfilePage from "./pages/profile_page";
import ChangePasswordPage from "./pages/change_password_page";
import LeaderboardPage from "./pages/leaderboard_page";
import MonthlyChampionsPage from "./pages/monthly_champions_page";
import IndividualRankingPage from "./pages/individual_ranking_page";
import ShopsPage from "./pages/shops_page";
import ShopProfilePage from "./pages/shop_profile_page";
import { getProfile } from "./services/profile_service";

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const { isDark } = useTheme();

  if (loading) {
    return (
      <div
        className={`flex min-h-screen items-center justify-center ${
          isDark ? "bg-slate-950 text-slate-100" : "bg-[#f0f2f5] text-slate-700"
        }`}
      >
        Loading application...
      </div>
    );
  }

  return user ? children : <Navigate to="/login" replace />;
}

function RequirePasswordChange({ children }) {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [mustChangePassword, setMustChangePassword] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadPasswordChangeStatus() {
      try {
        const profile = await getProfile();

        if (isMounted) {
          setMustChangePassword(Boolean(profile?.must_change_password));
        }
      } catch (profileError) {
        console.error("Password change profile load error:", profileError);

        if (isMounted) {
          setMustChangePassword(Boolean(user?.must_change_password));
        }
      }
    }

    if (user?.id) {
      setMustChangePassword(null);
      loadPasswordChangeStatus();
    } else {
      setMustChangePassword(false);
    }

    return () => {
      isMounted = false;
    };
  }, [user?.id, user?.must_change_password]);

  if (mustChangePassword === null) {
    return (
      <div
        className={`flex min-h-screen items-center justify-center ${
          isDark ? "bg-slate-950 text-slate-100" : "bg-[#f0f2f5] text-slate-700"
        }`}
      >
        Checking account security...
      </div>
    );
  }

  if (mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  return children;
}

function RequirePasswordChangeOnly({ children }) {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [mustChangePassword, setMustChangePassword] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadPasswordChangeStatus() {
      try {
        const profile = await getProfile();

        if (isMounted) {
          setMustChangePassword(Boolean(profile?.must_change_password));
        }
      } catch (profileError) {
        console.error("Password change profile load error:", profileError);

        if (isMounted) {
          setMustChangePassword(Boolean(user?.must_change_password));
        }
      }
    }

    if (user?.id) {
      setMustChangePassword(null);
      loadPasswordChangeStatus();
    } else {
      setMustChangePassword(false);
    }

    return () => {
      isMounted = false;
    };
  }, [user?.id, user?.must_change_password]);

  if (mustChangePassword === null) {
    return (
      <div
        className={`flex min-h-screen items-center justify-center ${
          isDark ? "bg-slate-950 text-slate-100" : "bg-[#f0f2f5] text-slate-700"
        }`}
      >
        Checking account security...
      </div>
    );
  }

  if (!mustChangePassword) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function AccessDeniedScreen() {
  const { isDark } = useTheme();

  return (
    <div
      className={`rounded-2xl border p-8 text-center ${
        isDark ? "border-slate-800 bg-slate-900 text-slate-200" : "border-slate-200 bg-white text-slate-700"
      }`}
    >
      <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Access denied</p>
      <h2 className={`mt-3 text-2xl font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
        Admin access is required
      </h2>
      <p className={`mx-auto mt-3 max-w-lg text-sm ${isDark ? "text-slate-400" : "text-slate-600"}`}>
        Your account does not have permission to view the admin dashboard.
      </p>
    </div>
  );
}

function RequireAdmin({ children }) {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [profileRole, setProfileRole] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadProfileRole() {
      setProfileLoading(true);

      try {
        const profile = await getProfile();

        if (isMounted) {
          setProfileRole(profile?.role?.toString().trim().toLowerCase() || null);
        }
      } catch (profileError) {
        console.error("Admin profile role load error:", profileError);

        if (isMounted) {
          setProfileRole(null);
        }
      } finally {
        if (isMounted) {
          setProfileLoading(false);
        }
      }
    }

    if (user?.id) {
      loadProfileRole();
    } else {
      setProfileRole(null);
      setProfileLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [user?.id, user?.role]);

  if (profileLoading) {
    return (
      <div
        className={`flex min-h-screen items-center justify-center ${
          isDark ? "bg-slate-950 text-slate-100" : "bg-[#f0f2f5] text-slate-700"
        }`}
      >
        Checking admin access...
      </div>
    );
  }

  if (!["admin", "accountant"].includes(profileRole)) {
    return <AccessDeniedScreen />;
  }

  return children;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SocketProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/change-password"
                element={
                  <RequireAuth>
                    <RequirePasswordChangeOnly>
                      <ChangePasswordPage />
                    </RequirePasswordChangeOnly>
                  </RequireAuth>
                }
              />
              <Route
                path="/admin"
                element={
                  <RequireAuth>
                    <RequirePasswordChange>
                      <RequireAdmin>
                        <AdminLayout />
                      </RequireAdmin>
                    </RequirePasswordChange>
                  </RequireAuth>
                }
              >
                <Route index element={createAdminRouteElement(adminRoutes[0])} />
                {adminRoutes.map((route) => (
                  <Route key={route.path} path={route.path} element={createAdminRouteElement(route)} />
                ))}
                <Route path="*" element={<Navigate to="/admin" replace />} />
              </Route>
              <Route
                path="/"
                element={
                  <RequireAuth>
                    <RequirePasswordChange>
                      <MainLayout />
                    </RequirePasswordChange>
                  </RequireAuth>
                }
              >
                <Route index element={<HomePage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="anonymous-mailbox" element={<AnonymousMailboxPage />} />
                <Route path="leaderboard" element={<LeaderboardPage />} />
                <Route path="monthly-champions" element={<MonthlyChampionsPage />} />
                <Route path="individual-ranking" element={<IndividualRankingPage />} />
                <Route path="shops" element={<ShopsPage />} />
                <Route path="shops/:shopId" element={<ShopProfilePage />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="profile/:userId" element={<ProfilePage />} />
                <Route path="shop/:id" element={<ShopProfilePage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
