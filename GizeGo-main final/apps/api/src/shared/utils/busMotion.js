import { pointAlongPath, pathTotalMeters } from "./polyline.js";

/** Deterministic progress in [0, 0.35) from bus id for repeatable simulation. */
export function initialBusProgress(busId) {
  const s = String(busId ?? "0");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % 350) / 1000;
}

/** ETA minutes from remaining distance and speed (never negative). */
export function etaMinutesFromRemaining(remainingMeters, speedMps, progress) {
  if (progress >= 1 || remainingMeters <= 0) return 0;
  if (!Number.isFinite(speedMps) || speedMps <= 0) return 0;
  return Math.max(0, Math.round(remainingMeters / speedMps / 60));
}

/**
 * Advance bus along polyline by elapsed time.
 * progress += (speed * dt) / pathLength — deterministic, no random jumps.
 */
export function advanceBusAlongPath(bus, tickMs, speedMps, trafficFactor) {
  bus.speedMps = speedMps;
  const pathLen = bus.totalMeters || pathTotalMeters(bus.path) || 1;

  if (bus.progress >= 1) {
    bus.progress = 1;
    bus.status = "arrived";
    bus.atDestinationTicks = (bus.atDestinationTicks ?? 0) + 1;
  } else {
    const advance = (speedMps * tickMs) / 1000 / pathLen;
    bus.progress = Math.min(1, bus.progress + advance);
    bus.atDestinationTicks = 0;
    bus.status = trafficFactor >= 1.3 ? "delayed" : "moving";
  }

  const sample = pointAlongPath(bus.path, bus.progress);
  if (!sample) return null;

  bus.etaMinutes = etaMinutesFromRemaining(sample.remainingMeters, speedMps, bus.progress);
  bus.remainingMeters = sample.remainingMeters;
  bus.traveledMeters = sample.traveledMeters;
  bus.totalPathMeters = sample.totalMeters;

  const point = { latitude: sample.point.latitude, longitude: sample.point.longitude };
  const trail = bus.trail ?? [];
  const last = trail[trail.length - 1];
  if (!last || haversine(last, point) > 8) {
    bus.trail = [...trail, point].slice(-30);
  }

  bus.lastSample = sample;
  return sample;
}

function haversine(a, b) {
  const R = 6371000;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
