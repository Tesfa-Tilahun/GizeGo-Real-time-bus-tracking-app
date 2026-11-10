import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/** Admin portal shell — all features visible after admin login; no driver login here. */
export default function Layout({ children }) {
  const { user, isAdmin, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to={isAdmin ? "/admin/dashboard" : "/login"} className="brand">
          <span className="brand-mark">G</span>
          GizeGo Admin
        </Link>
        {isAdmin && (
          <nav className="topnav">
            <NavLink to="/admin/dashboard">Dashboard</NavLink>
            <NavLink to="/" end>
              Browse routes
            </NavLink>
            <NavLink to="/admin/routes">Manage routes</NavLink>
            <NavLink to="/admin/buses">Operators &amp; buses</NavLink>
            <NavLink to="/admin/feedback">Feedback</NavLink>
            <NavLink to="/admin">Fleet &amp; drivers</NavLink>
          </nav>
        )}
        <div className="topbar-auth">
          {isAdmin ? (
            <>
              <span className="user-chip">{user.name}</span>
              <button type="button" className="btn-text" onClick={logout}>
                Sign out
              </button>
            </>
          ) : (
            <NavLink to="/login" className="btn-primary small">
              Admin login
            </NavLink>
          )}
        </div>
      </header>
      <main className="page">{children}</main>
    </div>
  );
}
