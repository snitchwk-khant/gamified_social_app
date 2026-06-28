import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/auth_context";
import { SocketProvider } from "./context/socket_context";
import { ThemeProvider, useTheme } from "./context/theme_context";
import MainLayout from "./layouts/main_layout";
import AdminPage from "./pages/admin_page";
import HomePage from "./pages/home_page";
import LoginPage from "./pages/login_page";
import NotificationsPage from "./pages/notifications_page";
import ProfilePage from "./pages/profile_page";
import ChangePasswordPage from "./pages/change_password_page";

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

  if (user?.must_change_password) {
    return <Navigate to="/change-password" replace />;
  }

  return children;
}

function RequirePasswordChangeOnly({ children }) {
  const { user } = useAuth();

  if (!user?.must_change_password) {
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
  const role = user?.role?.toString().trim().toLowerCase();

  if (role !== "admin") {
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
                <Route path="profile" element={<ProfilePage />} />
                <Route path="profile/:userId" element={<ProfilePage />} />
                <Route
                  path="admin"
                  element={
                    <RequireAdmin>
                      <AdminPage />
                    </RequireAdmin>
                  }
                />
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
