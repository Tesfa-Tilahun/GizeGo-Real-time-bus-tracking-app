import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  createRoute,
  deleteRoute,
  fetchRoute,
  fetchRoutes,
  updateRoute,
} from "../api";
import { useAuth } from "../context/AuthContext";

const emptyForm = () => ({
  code: "",
  originName: "",
  originLat: "9.03",
  originLng: "38.75",
  destName: "",
  destLat: "9.03",
  destLng: "38.75",
  durationMinutes: "",
  distanceKm: "",
  price: "",
});

function formFromRoute(route) {
  const dep = route.departure ?? route.stops?.[0];
  const arr = route.arrival ?? route.stops?.[route.stops.length - 1];
  return {
    code: route.code ?? "",
    originName: dep?.name ?? "",
    originLat: String(dep?.latitude ?? 9.03),
    originLng: String(dep?.longitude ?? 38.75),
    destName: arr?.name ?? "",
    destLat: String(arr?.latitude ?? 9.03),
    destLng: String(arr?.longitude ?? 38.75),
    durationMinutes: route.durationMinutes != null ? String(route.durationMinutes) : "",
    distanceKm:
      route.distanceMeters != null ? String((route.distanceMeters / 1000).toFixed(1)) : "",
    price: route.price != null ? String(route.price) : "",
  };
}

function buildPayload(form) {
  const departure = {
    name: form.originName.trim(),
    latitude: Number(form.originLat),
    longitude: Number(form.originLng),
  };
  const arrival = {
    name: form.destName.trim(),
    latitude: Number(form.destLat),
    longitude: Number(form.destLng),
  };
  const payload = {
    code: form.code.trim() || undefined,
    name: `${departure.name} -> ${arrival.name}`,
    price: Number(form.price),
    departure,
    arrival,
  };
  if (form.durationMinutes !== "") {
    payload.durationMinutes = Number(form.durationMinutes);
  }
  if (form.distanceKm !== "") {
    payload.distanceMeters = Math.round(Number(form.distanceKm) * 1000);
  }
  return payload;
}

export default function AdminRoutesPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [routes, setRoutes] = useState([]);
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadRoutes() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchRoutes();
      setRoutes(data.routes ?? []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAdmin) loadRoutes();
  }, [isAdmin]);

  function resetForm() {
    setForm(emptyForm());
    setEditingId(null);
  }

  async function handleEdit(routeSummary) {
    setError("");
    setMessage("");
    try {
      const data = await fetchRoute(routeSummary.id);
      setForm(formFromRoute(data.route));
      setEditingId(routeSummary.id);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleDelete(routeId, routeName) {
    if (!window.confirm(`Delete route "${routeName}"? This cannot be undone.`)) return;
    setError("");
    setMessage("");
    try {
      await deleteRoute(routeId);
      if (editingId === routeId) resetForm();
      setMessage("Route deleted.");
      await loadRoutes();
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const payload = buildPayload(form);
      if (editingId) {
        await updateRoute(editingId, payload);
        setMessage("Route updated.");
      } else {
        await createRoute(payload);
        setMessage("Route created.");
      }
      resetForm();
      await loadRoutes();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading) return <p className="status">Loading…</p>;
  if (!isAdmin) return <Navigate to="/login" replace />;

  return (
    <div className="admin-page">
      <div className="page-header">
        <div>
          <h1>Manage routes</h1>
          <p className="subtitle">Create, update, or delete bus routes</p>
        </div>
      </div>

      {message && <p className="status success">{message}</p>}
      {error && <p className="status error">{error}</p>}

      <section className="admin-section">
        <h2>{editingId ? "Edit route" : "Create new route"}</h2>
        <form className="route-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              Route code
              <input
                placeholder="e.g. A99 or AB050"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </label>
            <label>
              Duration (minutes)
              <input
                type="number"
                min="1"
                placeholder="41"
                value={form.durationMinutes}
                onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
              />
            </label>
            <label>
              Distance (km)
              <input
                type="number"
                min="0"
                step="0.1"
                placeholder="13.5"
                value={form.distanceKm}
                onChange={(e) => setForm({ ...form, distanceKm: e.target.value })}
              />
            </label>
            <label>
              Fare (ETB)
              <input
                type="number"
                min="0"
                step="1"
                placeholder="34"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                required
              />
            </label>
          </div>

          <div className="form-grid two-col">
            <fieldset>
              <legend>Origin stop</legend>
              <label>
                Name
                <input
                  value={form.originName}
                  onChange={(e) => setForm({ ...form, originName: e.target.value })}
                  required
                />
              </label>
              <label>
                Latitude
                <input
                  type="number"
                  step="any"
                  value={form.originLat}
                  onChange={(e) => setForm({ ...form, originLat: e.target.value })}
                  required
                />
              </label>
              <label>
                Longitude
                <input
                  type="number"
                  step="any"
                  value={form.originLng}
                  onChange={(e) => setForm({ ...form, originLng: e.target.value })}
                  required
                />
              </label>
            </fieldset>

            <fieldset>
              <legend>Destination stop</legend>
              <label>
                Name
                <input
                  value={form.destName}
                  onChange={(e) => setForm({ ...form, destName: e.target.value })}
                  required
                />
              </label>
              <label>
                Latitude
                <input
                  type="number"
                  step="any"
                  value={form.destLat}
                  onChange={(e) => setForm({ ...form, destLat: e.target.value })}
                  required
                />
              </label>
              <label>
                Longitude
                <input
                  type="number"
                  step="any"
                  value={form.destLng}
                  onChange={(e) => setForm({ ...form, destLng: e.target.value })}
                  required
                />
              </label>
            </fieldset>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? "Saving…" : editingId ? "Update route" : "Create route"}
            </button>
            {editingId && (
              <button type="button" className="btn-secondary" onClick={resetForm}>
                Cancel edit
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="admin-section">
        <h2>All routes ({routes.length})</h2>
        {loading ? (
          <p className="status">Loading routes…</p>
        ) : (
          <div className="fleet-table-wrap">
            <table className="fleet-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Route</th>
                  <th>Duration</th>
                  <th>Distance</th>
                  <th>Fare</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {routes.map((route) => (
                  <tr key={route.id}>
                    <td>{route.code ?? "—"}</td>
                    <td>{route.name}</td>
                    <td>{route.durationMinutes != null ? `${route.durationMinutes}m` : "—"}</td>
                    <td>
                      {route.distanceMeters != null
                        ? `${(route.distanceMeters / 1000).toFixed(1)} km`
                        : "—"}
                    </td>
                    <td>{Math.round(route.price)} ETB</td>
                    <td className="row-actions">
                      <button type="button" className="btn-text" onClick={() => handleEdit(route)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() => handleDelete(route.id, route.name)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
