import { pointAlongPath, pathTotalMeters } from "../shared/utils/polyline.js";
import { advanceBusAlongPath, etaMinutesFromRemaining } from "../shared/utils/busMotion.js";

const MIN_TICK_MS = 2000;
const MAX_TICK_MS = 5000;
export const BASE_SPEED_MPS = 8.5;

/**
 * Reusable logic: advance buses along polylines with traffic-aware speed.
 */
export class BusMovementEngine {
  nextTickDelayMs() {
    return MIN_TICK_MS + Math.floor(Math.random() * (MAX_TICK_MS - MIN_TICK_MS));
  }

  advanceBus(bus, tickMs, speedMps, trafficFactor) {
    return advanceBusAlongPath(bus, tickMs, speedMps, trafficFactor);
  }

  buildPath(polyline, stopRows) {
    let path = decodePolyline(polyline);
    if (path.length < 2 && stopRows?.length >= 2) {
      path = stopRows.map((s) => ({
        latitude: Number(s.latitude),
        longitude: Number(s.longitude),
      }));
    }
    return { path, totalMeters: Math.max(pathTotalMeters(path), 1) };
  }

  /** Next stop ahead on route by progress (0–1). */
  resolveNextStop(stops, progress) {
    if (!stops?.length) return null;
    const ordered = [...stops].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
    const idx = Math.min(
      ordered.length - 1,
      Math.max(0, Math.floor(progress * ordered.length)),
    );
    const next = ordered[Math.min(idx + 1, ordered.length - 1)];
    return {
      stopId: next.id,
      stopName: next.name,
      sequenceOrder: next.sequenceOrder,
      latitude: next.latitude,
      longitude: next.longitude,
    };
  }
}

export { etaMinutesFromRemaining };
