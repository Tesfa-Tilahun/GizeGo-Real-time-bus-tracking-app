import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { fetchRoutes } from "../api";
import RouteCard from "../components/RouteCard";

export default function RoutesPage() {
  const location = useLocation();
  const [routes, setRoutes] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRoutes = useCallback(() => {
    setLoading(true);
    fetchRoutes()
      .then((data) => setRoutes(data.routes ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadRoutes();
  }, [loadRoutes, location.pathname]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return routes;
    return routes.filter(
      (r) =>
        r.name?.toLowerCase().includes(q) ||
        r.code?.toLowerCase().includes(q),
    );
  }, [routes, query]);

  return (
    <div className="routes-page">
      <div className="page-header">
        <div>
          <h1>Bus routes</h1>
          <p className="subtitle">
            Ambessa, Addis & Shega — Addis Ababa transit lines
          </p>
        </div>
        <input
          type="search"
          className="search-input"
          placeholder="Search route or stop…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Link to="/admin/routes" className="btn-primary small">
          Manage routes
        </Link>
      </div>

      {loading && <p className="status">Loading routes…</p>}
      {error && <p className="status error">{error}</p>}

      <div className="route-list">
        {filtered.map((route) => (
          <RouteCard key={route.id} route={route} />
        ))}
        {!loading && filtered.length === 0 && (
          <p className="status">No routes match your search.</p>
        )}
      </div>
    </div>
  );
}
