import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { useAuth } from "../../hooks/useAuth";
import { LoadingSpinner } from "./LoadingSpinner";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
