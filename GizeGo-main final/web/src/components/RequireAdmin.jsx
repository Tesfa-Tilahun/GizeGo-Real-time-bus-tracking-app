import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function RequireAdmin({ children }) {
  const { isAdmin, loading } = useAuth();

  if (loading) return <p className="status">Loading…</p>;
  if (!isAdmin) return <Navigate to="/login" replace state={{ from: "admin" }} />;

  return children;
}
