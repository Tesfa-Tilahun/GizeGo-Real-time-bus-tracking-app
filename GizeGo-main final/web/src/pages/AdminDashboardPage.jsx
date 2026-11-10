import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchAdminDashboard, fetchOperationsReport } from "../api";
import { useAuth } from "../context/AuthContext";

const CONGESTION_COLORS = { light: "#66bb6a", moderate: "#ffa726", heavy: "#ef5350" };
const STATUS_CLASS = {
  moving: "status-pill moving",
  delayed: "status-pill delayed",
  stopped: "status-pill stopped",
};

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminDashboardPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState("24h");
  const [routeId, setRouteId] = useState("");
  const [busId, setBusId] = useState("");
  const [reportMsg, setReportMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const dash = await fetchAdminDashboard({
        period,
        routeId: routeId || undefined,
        busId: busId || undefined,
      });
      setData(dash);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [period, routeId, busId]);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  useEffect(() => {
    if (!isAdmin) return undefined;
    const iv = setInterval(() => void load(), 15000);
    return () => clearInterval(iv);
  }, [isAdmin, load]);

  const busOptions = useMemo(() => {
    if (!data?.filterOptions?.buses) return [];
    if (!routeId) return data.filterOptions.buses;
    return data.filterOptions.buses.filter((b) => b.routeId === routeId);
  }, [data, routeId]);

  async function handleReport() {
    setReportMsg("");
    try {
      const report = await fetchOperationsReport({
        period,
        routeId: routeId || undefined,
        busId: busId || undefined,
      });
      const stamp = new Date().toISOString().slice(0, 10);
      downloadJson(`gizego-operations-report-${stamp}.json`, report);
      setReportMsg("Report downloaded.");
    } catch (e) {
      setReportMsg(e.message);
    }
  }

  if (authLoading) return <p className="status">Loading…</p>;
  if (!isAdmin) return <Navigate to="/login" replace />;

  const summary = data?.summary;
  const charts = data?.charts;

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <h1>Dashboard & Analytics</h1>
          <p className="subtitle">
            Real-time fleet status, travel times, delays, and congestion (FR8)
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => void load()} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <section className="admin-section filter-bar">
        <label>
          Time period
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            {(data?.filterOptions?.periods ?? [{ id: "24h", label: "Last 24 hours" }]).map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Route
          <select
            value={routeId}
            onChange={(e) => {
              setRouteId(e.target.value);
              setBusId("");
            }}
          >
            <option value="">All routes</option>
            {(data?.filterOptions?.routes ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Bus
          <select value={busId} onChange={(e) => setBusId(e.target.value)}>
            <option value="">All buses</option>
            {busOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn-secondary" onClick={() => void handleReport()}>
          Download report
        </button>
      </section>

      {error ? <p className="status error">{error}</p> : null}
      {reportMsg ? <p className="status success">{reportMsg}</p> : null}

      {(summary?.feedbackPending ?? 0) > 0 && (
        <section className="admin-section feedback-alert">
          <p>
            <strong>{summary.feedbackPending}</strong> passenger feedback item
            {summary.feedbackPending === 1 ? "" : "s"} waiting for review.{" "}
            <Link to="/admin/feedback">Review feedback →</Link>
          </p>
        </section>
      )}

      {summary ? (
        <div className="kpi-grid">
          <div className="kpi-card">
            <span className="kpi-label">Live buses</span>
            <span className="kpi-value">{summary.totalLive}</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Moving</span>
            <span className="kpi-value ok">{summary.moving}</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Delayed</span>
            <span className="kpi-value warn">{summary.delayed}</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Stopped</span>
            <span className="kpi-value">{summary.stopped}</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Avg travel time</span>
            <span className="kpi-value">
              {summary.avgTravelTimeMinutes != null ? `${summary.avgTravelTimeMinutes} min` : "—"}
            </span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Avg speed</span>
            <span className="kpi-value">
              {summary.avgSpeedKmh != null ? `${summary.avgSpeedKmh} km/h` : "—"}
            </span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Passenger feedback</span>
            <span className="kpi-value">{summary.feedbackTotal ?? 0}</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Pending review</span>
            <span className="kpi-value warn">{summary.feedbackPending ?? 0}</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Avg rating</span>
            <span className="kpi-value">
              {summary.feedbackAvgRating != null ? `${summary.feedbackAvgRating} / 5` : "—"}
            </span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">Accepted</span>
            <span className="kpi-value ok">{summary.feedbackAccepted ?? 0}</span>
          </div>
        </div>
      ) : null}

      {(charts?.feedbackByCategory?.length > 0 || charts?.feedbackByRating?.length > 0) && (
        <div className="chart-grid">
          <section className="admin-section chart-card">
            <h2>Feedback by category</h2>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={charts.feedbackByCategory ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" name="Reports" fill="#5c6bc0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>

          <section className="admin-section chart-card">
            <h2>Feedback by rating</h2>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={charts.feedbackByRating ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="rating" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" name="Count" fill="#ffb300" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>

          {(charts?.feedbackTrend?.length ?? 0) > 0 && (
            <section className="admin-section chart-card">
              <h2>Feedback over time</h2>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={charts.feedbackTrend ?? []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="left" allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" domain={[1, 5]} />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="count" name="Submissions" fill="#0d7377" />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="avgRating"
                    name="Avg rating"
                    stroke="#e65100"
                    strokeWidth={2}
                    dot
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </section>
          )}
        </div>
      )}

      <div className="chart-grid">
        <section className="admin-section chart-card">
          <h2>Average travel time by route</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={charts?.avgTravelTimeByRoute ?? []} margin={{ top: 8, right: 8, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="routeName" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" interval={0} height={70} />
              <YAxis unit=" min" />
              <Tooltip />
              <Legend />
              <Bar dataKey="avgEtaMinutes" name="Avg ETA (min)" fill="#0d7377" radius={[4, 4, 0, 0]} />
              <Bar dataKey="scheduledMinutes" name="Scheduled (min)" fill="#90caf9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>

        <section className="admin-section chart-card">
          <h2>Delay events by hour</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={charts?.delayTrend ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="delays" name="Delays" stroke="#e65100" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </section>

        <section className="admin-section chart-card">
          <h2>Congestion (live fleet)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={charts?.congestionPie ?? []}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label
              >
                {(charts?.congestionPie ?? []).map((entry) => (
                  <Cell key={entry.level} fill={CONGESTION_COLORS[entry.level] ?? "#ccc"} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </section>

        <section className="admin-section chart-card">
          <h2>Congestion patterns by hour</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={charts?.congestionTrend ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="light" stackId="a" fill={CONGESTION_COLORS.light} name="Light" />
              <Bar dataKey="moderate" stackId="a" fill={CONGESTION_COLORS.moderate} name="Moderate" />
              <Bar dataKey="heavy" stackId="a" fill={CONGESTION_COLORS.heavy} name="Heavy" />
            </BarChart>
          </ResponsiveContainer>
        </section>
      </div>

      <section className="admin-section">
        <h2>Real-time fleet status</h2>
        <p className="subtitle">
          Updated {data?.generatedAt ? new Date(data.generatedAt).toLocaleString() : "—"} · auto-refresh every 15s
        </p>
        <div className="fleet-table-wrap">
          <table className="fleet-table">
            <thead>
              <tr>
                <th>Bus</th>
                <th>Route</th>
                <th>Status</th>
                <th>Speed</th>
                <th>ETA</th>
                <th>Traffic</th>
              </tr>
            </thead>
            <tbody>
              {(data?.fleetStatus ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6}>No live buses — ensure fleet is assigned to routes.</td>
                </tr>
              ) : (
                data.fleetStatus.map((b) => (
                  <tr key={`${b.busId}-${b.routeId}`}>
                    <td>{b.busName}</td>
                    <td>{b.routeName}</td>
                    <td>
                      <span className={STATUS_CLASS[b.status] ?? "status-pill"}>{b.status}</span>
                    </td>
                    <td>{b.speedKmh != null ? `${b.speedKmh} km/h` : "—"}</td>
                    <td>{b.etaMinutes != null ? `~${b.etaMinutes} min` : "—"}</td>
                    <td>{b.trafficLevel ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
