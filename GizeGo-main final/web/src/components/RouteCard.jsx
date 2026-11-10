import { Link } from "react-router-dom";

function formatDuration(minutes) {
  if (minutes == null) return "—";
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h 0m`;
  }
  return `${minutes}m`;
}

function formatDistance(meters) {
  if (meters == null) return "—";
  return `${(meters / 1000).toFixed(1)} km`;
}

function operatorFromCode(code) {
  if (!code) return "ABO";
  if (code.startsWith("AB")) return "ABO";
  return code.slice(0, 3);
}

export default function RouteCard({ route }) {
  const code = route.code ?? route.id;
  const badge = operatorFromCode(code);

  return (
    <article className="route-card">
      <div className="route-card-left">
        <div className="route-badge-circle">{badge}</div>
        <span className="route-code-pill">{code}</span>
      </div>
      <div className="route-card-main">
        <h3 className="route-name">{route.name}</h3>
      </div>
      <div className="route-metrics">
        <div className="metric">
          <span className="metric-value">{formatDuration(route.durationMinutes)}</span>
          <span className="metric-label">Duration</span>
        </div>
        <div className="metric">
          <span className="metric-value">{formatDistance(route.distanceMeters)}</span>
          <span className="metric-label">Distance</span>
        </div>
        <div className="metric">
          <span className="metric-value fare">{Math.round(route.price)} ETB</span>
          <span className="metric-label">Est. Fare</span>
        </div>
        <Link to={`/routes/${route.id}/map`} className="btn-primary small route-map-link">
          View on map
        </Link>
      </div>
    </article>
  );
}
