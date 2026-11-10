import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { io } from "socket.io-client";
import { SOCKET_URL } from "../config/socket.js";
import { localizeAlert } from "../utils/alertCopy.js";
import { useLocale } from "./LocaleContext.js";
import { useAlertPush, requestNotificationPermissions, getNotificationPermissionStatus } from "../hooks/usePassengerNotifications.js";

const MAX_ALERTS = 30;
const ARRIVED_RADIUS_METERS = 120;
const ALLOWED_TYPES = new Set([
  "bus_arrived",
  "bus_delayed",
  "accident_missed_arrival",
  "route_accident",
]);

/** Push + in-app alerts: delays and arrival only. */
export const PASSENGER_NOTIFY_TYPES = ALLOWED_TYPES;

const RealtimeContext = createContext(null);

function groupBusesByRoute(buses) {
  const grouped = {};
  for (const bus of buses) {
    if (!bus?.routeId || !bus?.busId) continue;
    if (!grouped[bus.routeId]) grouped[bus.routeId] = [];
    const exists = grouped[bus.routeId].some((b) => b.busId === bus.busId);
    if (!exists) grouped[bus.routeId].push(bus);
  }
  return grouped;
}

function dedupeBuses(buses) {
  const seen = new Set();
  const out = [];
  for (const bus of buses ?? []) {
    if (!bus?.busId) continue;
    const key = `${bus.routeId ?? ""}:${bus.busId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(bus);
  }
  return out;
}

export function RealtimeProvider({ children }) {
  const { t } = useLocale();
  const [alerts, setAlerts] = useState([]);
  const [socketConnected, setSocketConnected] = useState(false);
  const [watchedRouteId, setWatchedRouteId] = useState(null);
  const [routeBuses, setRouteBuses] = useState({});
  const [trafficByRoute, setTrafficByRoute] = useState({});
  const [nearbyBuses, setNearbyBuses] = useState([]);
  const [pushPermissionStatus, setPushPermissionStatus] = useState(null);

  const refreshPushPermission = useCallback(async () => {
    const status = await getNotificationPermissionStatus();
    setPushPermissionStatus(status);
    return status;
  }, []);

  const pushNotificationsGranted = pushPermissionStatus === "granted";
  const showMapBannerFallback =
    pushPermissionStatus != null && pushPermissionStatus !== "granted";

  const socketRef = useRef(null);
  const watchedRouteRef = useRef(null);
  const watchedMetaRef = useRef({});
  const passengerCoordsRef = useRef(null);
  const arrivedBusRef = useRef(new Set());

  useEffect(() => {
    void refreshPushPermission();
  }, [refreshPushPermission]);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      timeout: 20000,
    });
    socketRef.current = socket;

    const onAlert = (payload) => {
      if (!ALLOWED_TYPES.has(payload?.type)) return;
      if (!payload?.message && !payload?.title) return;

      const routeId = watchedRouteRef.current;
      if (routeId && payload.routeId && payload.routeId !== routeId) return;

      const row = { ...payload, id: `${Date.now()}-${Math.random()}` };
      setAlerts((prev) => {
        if (
          payload.type === "bus_arrived" &&
          payload.busId &&
          prev.some((a) => a.type === "bus_arrived" && a.busId === payload.busId)
        ) {
          return prev;
        }
        return [row, ...prev].slice(0, MAX_ALERTS);
      });
    };

    const onBusLocations = (payload) => {
      const buses = dedupeBuses(payload?.buses ?? []);
      if (payload.routeId) {
        setRouteBuses((prev) => ({ ...prev, [payload.routeId]: buses }));
        if (payload.traffic) {
          setTrafficByRoute((prev) => ({ ...prev, [payload.routeId]: payload.traffic }));
        }
        return;
      }
      if (buses.length > 0) {
        setRouteBuses((prev) => ({ ...prev, ...groupBusesByRoute(buses) }));
      }
    };

    const onTraffic = (payload) => {
      if (payload?.routeId && payload.traffic) {
        setTrafficByRoute((prev) => ({ ...prev, [payload.routeId]: payload.traffic }));
      }
    };

    const onNearby = (payload) => {
      if (payload?.buses) setNearbyBuses(dedupeBuses(payload.buses));
    };

    const subscribeWatched = () => {
      const routeId = watchedRouteRef.current;
      const meta = watchedMetaRef.current ?? {};
      if (!routeId) return;
      socket.emit("subscribe-route", {
        routeId,
        etaMinutes: meta.etaMinutes,
        stopName: meta.stopName,
        busName: meta.busName,
      });
    };

    socket.on("connect", () => {
      setSocketConnected(true);
      subscribeWatched();
    });
    socket.on("disconnect", () => setSocketConnected(false));
    socket.on("notification:alert", onAlert);
    socket.on("bus:locations", onBusLocations);
    socket.on("traffic:update", onTraffic);
    socket.on("nearby:buses", onNearby);

    return () => {
      socket.off("notification:alert", onAlert);
      socket.off("bus:locations", onBusLocations);
      socket.off("traffic:update", onTraffic);
      socket.off("nearby:buses", onNearby);
      socket.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
    };
  }, []);

  const emitRouteSubscribe = useCallback((routeId, meta, { fresh = false } = {}) => {
    const socket = socketRef.current;
    if (!socket?.connected || !routeId) return;
    socket.emit("subscribe-route", {
      routeId,
      etaMinutes: meta.etaMinutes,
      stopName: meta.stopName,
      busName: meta.busName,
      fresh,
    });
  }, []);

  const emitRouteMetaUpdate = useCallback((routeId, meta) => {
    const socket = socketRef.current;
    if (!socket?.connected || !routeId) return;
    socket.emit("update-route-watch", {
      routeId,
      etaMinutes: meta.etaMinutes,
      stopName: meta.stopName,
      busName: meta.busName,
    });
  }, []);

  const watchRoute = useCallback(
    (routeId, meta = {}) => {
      const prev = watchedRouteRef.current;
      const socket = socketRef.current;

      if (!routeId) {
        if (prev && socket?.connected) {
          socket.emit("unsubscribe-route", { routeId: prev });
        }
        watchedRouteRef.current = null;
        watchedMetaRef.current = {};
        arrivedBusRef.current.clear();
        setWatchedRouteId(null);
        return;
      }

      void requestNotificationPermissions().then(() => refreshPushPermission());
      watchedMetaRef.current = meta ?? {};
      arrivedBusRef.current.clear();

      if (prev === routeId) {
        setWatchedRouteId(routeId);
        emitRouteMetaUpdate(routeId, meta);
        return;
      }

      if (prev && socket?.connected) {
        socket.emit("unsubscribe-route", { routeId: prev });
      }

      watchedRouteRef.current = routeId;
      setWatchedRouteId(routeId);
      emitRouteSubscribe(routeId, meta, { fresh: true });
    },
    [emitRouteMetaUpdate, emitRouteSubscribe, refreshPushPermission],
  );

  const checkLocalArrival = useCallback(
    (coords) => {
      const routeId = watchedRouteRef.current;
      if (!routeId || !coords) return;
      const buses = routeBuses[routeId];
      if (!buses?.length) return;

      for (const bus of buses) {
        const key = `${routeId}:${bus.busId}`;
        if (arrivedBusRef.current.has(key)) continue;
        const dist = haversineMeters(coords, {
          latitude: bus.latitude,
          longitude: bus.longitude,
        });
        if (dist > ARRIVED_RADIUS_METERS) continue;

        arrivedBusRef.current.add(key);
        const meta = watchedMetaRef.current ?? {};
        const stopName = meta.stopName ?? null;
        const busName = bus.busName ?? meta.busName ?? "Bus";
        setAlerts((prev) => {
          if (prev.some((a) => a.type === "bus_arrived" && a.busId === bus.busId)) return prev;
          const row = {
            id: `local-arrived-${Date.now()}-${bus.busId}`,
            type: "bus_arrived",
            severity: "info",
            title: t("notify.busArrivedTitle"),
            message: stopName
              ? t("notify.busArrivedStopMsg", { bus: busName, stop: stopName })
              : t("notify.busArrivedMsg", { bus: busName }),
            busId: bus.busId,
            busName,
            routeId,
            stopName,
            etaMinutes: 0,
            replacePrevious: true,
          };
          return [row, ...prev].slice(0, MAX_ALERTS);
        });
      }
    },
    [routeBuses, t],
  );

  const reportPassengerLocation = useCallback(
    (coords) => {
      passengerCoordsRef.current = coords ?? null;
      if (coords) checkLocalArrival(coords);
      const socket = socketRef.current;
      if (!socket?.connected || !coords) return;
      socket.emit("passenger:location", {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy ?? null,
        heading: coords.heading ?? null,
        speed: coords.speed ?? null,
      });
    },
    [checkLocalArrival],
  );

  useEffect(() => {
    checkLocalArrival(passengerCoordsRef.current);
  }, [routeBuses, watchedRouteId, checkLocalArrival]);

  const dismiss = useCallback((id) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const clearAll = useCallback(() => setAlerts([]), []);

  const localizedAlerts = useMemo(
    () => alerts.map((a) => localizeAlert(a, t)).filter(Boolean),
    [alerts, t],
  );

  useAlertPush(localizedAlerts, t);

  const value = useMemo(
    () => ({
      alerts: localizedAlerts,
      dismiss,
      clearAll,
      socketConnected,
      watchedRouteId,
      watchRoute,
      routeBuses,
      trafficByRoute,
      nearbyBuses,
      reportPassengerLocation,
      pushNotificationsGranted,
      showMapBannerFallback: !pushNotificationsGranted,
      refreshPushPermission,
    }),
    [
      localizedAlerts,
      dismiss,
      clearAll,
      socketConnected,
      watchedRouteId,
      watchRoute,
      routeBuses,
      trafficByRoute,
      nearbyBuses,
      reportPassengerLocation,
      pushNotificationsGranted,
      refreshPushPermission,
    ],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error("useRealtime must be inside RealtimeProvider");
  return ctx;
}

/** Back-compat alias used across the app. */
export function useNotifications() {
  const ctx = useRealtime();
  return {
    alerts: ctx.alerts,
    dismiss: ctx.dismiss,
    clearAll: ctx.clearAll,
    socketConnected: ctx.socketConnected,
    watchedRouteId: ctx.watchedRouteId,
    watchRoute: ctx.watchRoute,
    pushNotificationsGranted: ctx.pushNotificationsGranted,
    showMapBannerFallback: ctx.showMapBannerFallback,
  };
}

function haversineMeters(a, b) {
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

/** @deprecated use RealtimeProvider */
export const NotificationsProvider = RealtimeProvider;
