import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { SOCKET_URL } from "../config/socket.js";
import { localizeAlert } from "../utils/alertCopy.js";

const MAX_ALERTS = 8;

/**
 * FR7: WebSocket notifications (delays, ETA changes, traffic, bus arrival, incidents).
 * @param {string | null | undefined} routeId — filter to one route, or null for all
 * @param {(key: string, vars?: object) => string} [t] — optional i18n
 */
export function useRealtimeAlerts(routeId, t) {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ["websocket"], reconnection: true });

    if (routeId) {
      socket.on("connect", () => {
        socket.emit("subscribe-route", { routeId });
      });
    }

    const onAlert = (payload) => {
      if (!payload?.message && !payload?.title) return;
      if (routeId && payload.routeId && payload.routeId !== routeId) return;
      const row = { ...payload, id: `${Date.now()}-${Math.random()}` };
      setAlerts((prev) => [row, ...prev].slice(0, MAX_ALERTS));
    };

    socket.on("notification:alert", onAlert);
    return () => {
      if (routeId) socket.emit("unsubscribe-route", { routeId });
      socket.off("notification:alert", onAlert);
      socket.disconnect();
    };
  }, [routeId]);

  const dismiss = (id) => setAlerts((prev) => prev.filter((a) => a.id !== id));

  const localizedAlerts = useMemo(
    () => (t ? alerts.map((a) => localizeAlert(a, t)) : alerts),
    [alerts, t],
  );

  return { alerts: localizedAlerts, dismiss };
}
