import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { toLeafletLatLngs } from "../utils/polyline.js";

const ADDIS = [9.03, 38.75];

function busIcon(status) {
  const color =
    status === "arrived"
      ? "#2e7d32"
      : status === "delayed"
        ? "#f57c00"
        : status === "stopped"
          ? "#757575"
          : "#1a73e8";
  return L.divIcon({
    className: "leaflet-bus-marker-wrap",
    html: `<div class="leaflet-bus-marker" style="background:${color}">🚌</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

/**
 * Interactive route map using Leaflet + OpenStreetMap tiles.
 * @see https://leafletjs.com/
 */
export default function LeafletRouteMap({
  primaryCoords = [],
  alternativePaths = [],
  buses = [],
  selectedPathKey = "primary",
  onPathSelect,
  pathOptions = [],
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerGroupRef = useRef(null);
  const busMarkersRef = useRef(new Map());

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    const map = L.map(containerRef.current, { zoomControl: true }).setView(ADDIS, 13);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    layerGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
      busMarkersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();
    const bounds = [];

    const addPath = (coords, variant) => {
      if (!coords?.length || coords.length < 2) return;
      const latlngs = toLeafletLatLngs(coords);
      latlngs.forEach((ll) => bounds.push(ll));
      const isPrimary = variant === "primary";
      if (isPrimary) {
        L.polyline(latlngs, {
          color: "#ffffff",
          weight: 12,
          opacity: 0.9,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(group);
      }
      L.polyline(latlngs, {
        color: isPrimary ? "#1a73e8" : "#90a4ae",
        weight: isPrimary ? 8 : 5,
        opacity: isPrimary ? 0.95 : 0.7,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(group);
    };

    if (selectedPathKey === "primary") {
      alternativePaths.forEach((alt) => addPath(alt.coordinates, "alternative"));
      addPath(primaryCoords, "primary");
    } else {
      addPath(primaryCoords, "alternative");
      alternativePaths.forEach((alt) => {
        const key = alt.routeId ?? alt.name;
        addPath(alt.coordinates, key === selectedPathKey ? "primary" : "alternative");
      });
    }

    if (primaryCoords.length > 1) {
      const start = primaryCoords[0];
      const end = primaryCoords[primaryCoords.length - 1];
      L.circleMarker([start.latitude, start.longitude], {
        radius: 8,
        color: "#0f9d58",
        fillColor: "#0f9d58",
        fillOpacity: 1,
        weight: 2,
      })
        .bindTooltip("Start")
        .addTo(group);
      L.circleMarker([end.latitude, end.longitude], {
        radius: 8,
        color: "#db4437",
        fillColor: "#db4437",
        fillOpacity: 1,
        weight: 2,
      })
        .bindTooltip("End")
        .addTo(group);
    }

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [48, 48] });
    }
  }, [primaryCoords, alternativePaths, selectedPathKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const seen = new Set();
    for (const bus of buses) {
      if (!Number.isFinite(bus.latitude) || !Number.isFinite(bus.longitude)) continue;
      seen.add(bus.busId);
      const latlng = [bus.latitude, bus.longitude];
      let marker = busMarkersRef.current.get(bus.busId);
      if (!marker) {
        marker = L.marker(latlng, { icon: busIcon(bus.status), zIndexOffset: 500 });
        marker.addTo(map);
        busMarkersRef.current.set(bus.busId, marker);
      } else {
        marker.setLatLng(latlng);
        marker.setIcon(busIcon(bus.status));
      }
      marker.bindTooltip(
        `<strong>${bus.busName ?? "Bus"}</strong><br/>${bus.status ?? "moving"} · ETA ${bus.etaMinutes ?? "—"} min`,
      );
    }

    for (const [id, marker] of busMarkersRef.current) {
      if (!seen.has(id)) {
        marker.remove();
        busMarkersRef.current.delete(id);
      }
    }
  }, [buses]);

  return (
    <div className="leaflet-map-shell">
      {pathOptions.length > 1 ? (
        <div className="leaflet-path-picker">
          {pathOptions.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={`leaflet-path-chip ${selectedPathKey === opt.key ? "active" : ""} ${opt.isPrimary ? "shortest" : ""}`}
              onClick={() => onPathSelect?.(opt.key)}
            >
              <span className="chip-label">{opt.label}</span>
              {opt.minutes != null ? (
                <span className="chip-meta">{opt.minutes} min</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
      <div ref={containerRef} className="leaflet-map-canvas" />
      <p className="leaflet-attribution-note">
        Map data &copy; OpenStreetMap · Powered by{" "}
        <a href="https://leafletjs.com/" target="_blank" rel="noreferrer">
          Leaflet
        </a>
      </p>
    </div>
  );
}
