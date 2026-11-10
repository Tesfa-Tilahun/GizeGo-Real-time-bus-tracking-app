import { useState } from "react";
import { Link } from "react-router-dom";
import { forgotPassword } from "../api";

export default function DriverForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [devToken, setDevToken] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    setDevToken("");
    setSubmitting(true);
    try {
      const data = await forgotPassword(email.trim());
      setMessage(data.message ?? "If that email exists, we sent reset instructions.");
      if (data.devResetToken) {
        setDevToken(data.devResetToken);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Forgot password</h1>
        <p className="subtitle">Enter the email on your driver account.</p>

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>

        {error && <p className="status error">{error}</p>}
        {message && <p className="status success">{message}</p>}
        {devToken ? (
          <p className="status">
            Dev reset link:{" "}
            <Link to={`/driver/reset-password?token=${encodeURIComponent(devToken)}`}>
              Set new password
            </Link>
          </p>
        ) : null}

        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? "Sending…" : "Send reset link"}
        </button>

        <p className="auth-links">
          <Link to="/driver/login">Back to driver login</Link>
        </p>
      </form>
    </div>
  );
}
