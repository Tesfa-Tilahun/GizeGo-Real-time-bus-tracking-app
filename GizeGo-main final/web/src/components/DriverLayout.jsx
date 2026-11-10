import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/** Minimal shell for the driver portal — no admin login or admin navigation. */
export default function DriverLayout({ children }) {
  const { user, isDriver, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/driver" className="brand">
          <span className="brand-mark">G</span>
          GizeGo Driver
        </Link>
        <nav className="topnav">
          {isDriver && <NavLink to="/driver">My bus</NavLink>}
        </nav>
        <div className="topbar-auth">
          {user && isDriver ? (
            <>
              <span className="user-chip">{user.name}</span>
              <button type="button" className="btn-text" onClick={logout}>
                Sign out
              </button>
            </>
          ) : (
            <NavLink to="/driver/login" className="btn-primary small">
              Driver sign in
            </NavLink>
          )}
        </div>
      </header>
      <main className="page">{children}</main>
    </div>
  );
}
