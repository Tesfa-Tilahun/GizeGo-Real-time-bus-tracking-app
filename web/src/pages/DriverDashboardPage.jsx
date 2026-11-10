import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { fetchDriverAssignment } from "../api";
import { useAuth } from "../context/AuthContext";

export default function DriverDashboardPage() {
  const { user, isDriver, loading: authLoading } = useAuth();
  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isDriver) return;
    let active = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await fetchDriverAssignment();
        if (active) setAssignment(data);
      } catch (e) {
        if (active) setError(e.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [isDriver]);

  if (authLoading) return <p className="status">Loading…</p>;
  if (!user || !isDriver) return <Navigate to="/driver/login" replace />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Driver dashboard</h1>
          <p className="subtitle">Welcome, {user.name}</p>
        </div>
      </div>

      {loading ? <p className="status">Loading assignment…</p> : null}
      {error ? <p className="status error">{error}</p> : null}

      {!loading && !error && assignment && !assignment.assigned ? (
        <div className="admin-section">
          <h2>No bus assigned yet</h2>
          <p className="subtitle">{assignment.message}</p>
          <p className="subtitle">Your admin will assign you to a bus from the Fleet & Drivers page.</p>
        </div>
      ) : null}

      {!loading && !error && assignment?.assigned ? (
        <div className="admin-section">
          <h2>Your bus</h2>
          <p>
            <strong>{assignment.bus.name}</strong>
            {assignment.bus.operator ? (
              <>
                {" "}
                · <span className="operator-tag">{assignment.bus.operator}</span>
              </>
            ) : null}
          </p>

          {assignment.assignments?.length > 0 ? (
            <>
              <h3 style={{ marginTop: "1.25rem", marginBottom: "0.5rem" }}>Scheduled routes</h3>
              <div className="fleet-table-wrap">
                <table className="fleet-table">
                  <thead>
                    <tr>
                      <th>Route</th>
                      <th>From</th>
                      <th>To</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignment.assignments.map((a) => (
                      <tr key={a.routeId}>
                        <td>
                          {a.routeCode ? `${a.routeCode} · ` : ""}
                          {a.routeName}
                        </td>
                        <td>{a.departureStopName ?? "—"}</td>
                        <td>{a.arrivalStopName ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="subtitle">No routes scheduled on this bus yet.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
