import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "./auth-context";

export function ProtectedRoute() {
  const { session, isHydrated } = useAuth();
  const location = useLocation();

  if (!isHydrated) {
    return <div className="min-h-screen bg-gray-50" />;
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export function GuestRoute() {
  const { session, isHydrated } = useAuth();

  if (!isHydrated) {
    return <div className="min-h-screen bg-gray-50" />;
  }

  if (session) {
    return <Navigate to="/admin/assets" replace />;
  }

  return <Outlet />;
}
