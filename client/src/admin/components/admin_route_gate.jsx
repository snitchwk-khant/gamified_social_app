import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/auth_context";

function normalizeRole(role) {
  return role?.toString().trim().toLowerCase() || "employee";
}

function AdminRouteGate({ route, children }) {
  const { user } = useAuth();
  const role = normalizeRole(user?.role);

  if (!route.allowedRoles.includes(role)) {
    return <Navigate to="/admin" replace />;
  }

  return children;
}

export default AdminRouteGate;
