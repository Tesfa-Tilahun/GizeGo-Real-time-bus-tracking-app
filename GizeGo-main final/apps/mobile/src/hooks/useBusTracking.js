import { useMemo } from "react";
import { useRealtime } from "../context/RealtimeContext.js";

/**
 * Live simulated bus positions for a route (shared WebSocket).
 * @param {string | null | undefined} routeId
 */
export function useBusTracking(routeId) {
  const { routeBuses, trafficByRoute, socketConnected } = useRealtime();

  const buses = useMemo(
    () => (routeId ? (routeBuses[routeId] ?? []) : []),
    [routeId, routeBuses],
  );

  const traffic = routeId ? (trafficByRoute[routeId] ?? null) : null;

  return { buses, connected: socketConnected, traffic };
}
