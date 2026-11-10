import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import LeafletRouteMap from "../components/LeafletRouteMap.jsx";
import { fetchRoute, fetchRouteOptimize } from "../api.js";
import { coordsFromRoute } from "../utils/polyline.js";

function pathKey(alt, index) {
  return alt.routeId ?? alt.name ?? `alt-${index}`;
}

export default function RouteMapPage() {
  const { routeId } = useParams();
  const [route, setRoute] = useState(null);
  const [primaryCoords, setPrimaryCoords] = useState([]);
  const [alternativePaths, setAlternativePaths] = useState([]);
  const [primaryMinutes, setPrimaryMinutes] = useState(null);
  const [selectedPathKey, setSelectedPathKey] = useState("primary");
  const [buses, setBuses] = useState([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRoute = useCallback(async () => {
    if (!routeId) return;
    setLoading(true);
    setError("");
    try {
      const [detail, opt] = await Promise.all([
        fetchRoute(routeId),
        fetchRouteOptimize(routeId).catch(() => null),
      ]);
      const rr = detail.route;
      setRoute(rr);
      if (opt?.primary?.coordinates?.length > 1) {
        setPrimaryCoords(opt.primary.coordinates);
        setPrimaryMinutes(opt.primary.durationMinutes ?? null);
      } else {
        setPrimaryCoords(coordsFromRoute(rr));
        setPrimaryMinutes(rr?.durationMinutes ?? null);
      }
      setAlternativePaths((opt?.alternatives ?? []).filter((a) => a.coordinates?.length > 1));
      setSelectedPathKey("primary");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [routeId]);

  useEffect(() => {
    void loadRoute();
  }, [loadRoute]);

  useEffect(() => {
    if (!routeId) return undefined;

    const socket = io(window.location.origin, { transports: ["websocket", "polling"] });
    socket.on("connect", () => {
      setConnected(true);
      socket.emit("subscribe-route", { routeId, fresh: true });
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("bus:locations", (payload) => {
      if (payload?.routeId === routeId) {
        setBuses(payload.buses ?? []);
      }
    });

    return () => {
      socket.emit("unsubscribe-route", { routeId });
      socket.disconnect();
    };
  }, [routeId]);

  const pathOptions = useMemo(() => {
    const opts = [
      {
        key: "primary",
        label: "Shortest",
        minutes: primaryMinutes,
        isPrimary: true,
      },
    ];
    alternativePaths.forEach((alt, i) => {
      opts.push({
        key: pathKey(alt, i),
        label: `Option ${i + 2}`,
        minutes: alt.durationMinutes,
        isPrimary: false,
      });
    });
    return opts;
  }, [alternativePaths, primaryMinutes]);

  const displayPrimary = useMemo(() => {
    if (selectedPathKey === "primary") return primaryCoords;
    const idx = alternativePaths.findIndex((a, i) => pathKey(a, i) === selectedPathKey);
    if (idx >= 0) return alternativePaths[idx].coordinates;
    return primaryCoords;
  }, [selectedPathKey, primaryCoords, alternativePaths]);

  const displayAlternatives = useMemo(() => {
    if (selectedPathKey === "primary") return alternativePaths;
    return [
      {
        routeId: "primary-alt-view",
        name: "Shortest",
        coordinates: primaryCoords,
        durationMinutes: primaryMinutes,
      },
      ...alternativePaths.filter((a, i) => pathKey(a, i) !== selectedPathKey),
    ];
  }, [selectedPathKey, primaryCoords, primaryMinutes, alternativePaths]);

  return (
    <div className="route-map-page">
      <div className="page-header">
        <div>
          <Link to="/" className="btn-text map-back-link">
            ← All routes
          </Link>
          <h1>{route?.name ?? "Route map"}</h1>
          <p className="subtitle">
            {connected ? "● Live bus tracking" : "Connecting to live buses…"}
            {buses.length > 0 ? ` · ${buses.length} bus(es) on map` : ""}
          </p>
        </div>
      </div>

      {loading ? <p className="status">Loading map…</p> : null}
      {error ? <p className="status error">{error}</p> : null}

      {!loading && !error ? (
        <LeafletRouteMap
          primaryCoords={displayPrimary}
          alternativePaths={displayAlternatives}
          buses={buses}
          selectedPathKey={selectedPathKey}
          onPathSelect={setSelectedPathKey}
          pathOptions={pathOptions}
        />
      ) : null}

      {route ? (
        <div className="map-route-meta">
          {route.price != null ? (
            <span>
              Fare: <strong>{Math.round(route.price)} ETB</strong>
            </span>
          ) : null}
          {route.durationMinutes != null ? (
            <span>Duration: {route.durationMinutes} min</span>
          ) : null}
          {route.distanceMeters != null ? (
            <span>Distance: {(route.distanceMeters / 1000).toFixed(1)} km</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
