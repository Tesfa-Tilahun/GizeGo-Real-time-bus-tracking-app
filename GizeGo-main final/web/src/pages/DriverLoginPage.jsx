import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function DriverLoginPage() {
  const { login, logout, user, isDriver } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user && isDriver) {
    return <Navigate to="/driver" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const loggedIn = await login(identifier.trim(), password);
      if (loggedIn.role !== "driver") {
        logout();
        setError("Driver access only. Ask your admin to create a driver account.");
        return;
      }
      navigate("/driver");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Driver login</h1>
        <p className="subtitle">
          Sign in with the account your admin created. Drivers cannot self-register.
        </p>

        <label>
          Email or phone
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            autoComplete="username"
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>

        {error && <p className="status error">{error}</p>}

        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>

        <p className="auth-links">
          <Link to="/driver/forgot-password">Forgot password?</Link>
        </p>
      </form>
    </div>
  );
}
