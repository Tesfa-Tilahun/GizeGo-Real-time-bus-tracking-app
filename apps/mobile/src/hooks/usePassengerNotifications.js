import { useEffect, useRef, useState, useCallback } from "react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { localizeAlert } from "../utils/alertCopy.js";

const WAIT_NOTIF_ID = "gizego-bus-wait";
const ARRIVED_NOTIF_ID = "gizego-bus-arrived";
const DELAY_NOTIF_ID = "gizego-bus-delay";

const PUSH_NOTIFY_TYPES = new Set([
  "bus_arrived",
  "bus_delayed",
  "accident_missed_arrival",
  "route_accident",
]);

let handlerSet = false;

export function configureNotificationHandler() {
  if (handlerSet) return;
  handlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function requestNotificationPermissions() {
  if (Platform.OS === "web") return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

/** @returns {'granted'|'denied'|'undetermined'|'unsupported'} */
export async function getNotificationPermissionStatus() {
  if (Platform.OS === "web") return "unsupported";
  const { status } = await Notifications.getPermissionsAsync();
  if (status === "granted") return "granted";
  if (status === "denied") return "denied";
  return "undetermined";
}

export function isPushNotificationsGranted(status) {
  return status === "granted";
}

async function ensurePermissions() {
  return requestNotificationPermissions();
}

/**
 * Show a local push when a realtime alert arrives.
 * @param {object} alert — localized alert with title, message, type
 */
export async function pushAlertNotification(alert) {
  if (Platform.OS === "web" || !alert?.message) return;
  if (!PUSH_NOTIFY_TYPES.has(alert.type)) return;
  const ok = await ensurePermissions();
  if (!ok) return;

  if (alert.replacePrevious) {
    await Notifications.dismissNotificationAsync(WAIT_NOTIF_ID).catch(() => {});
  }

  const wait =
    alert.waitMinutes != null && alert.waitMinutes > 0
      ? ` · ${alert.waitMinutes} min`
      : "";

  const identifier =
    alert.type === "bus_arrived"
      ? ARRIVED_NOTIF_ID
      : alert.type === "bus_delayed" ||
          alert.type === "route_accident" ||
          alert.type === "accident_missed_arrival"
        ? DELAY_NOTIF_ID
        : WAIT_NOTIF_ID;

  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title: alert.title || "GizeGo",
      body: `${alert.message}${wait}`,
      data: {
        type: alert.type,
        phase: alert.phase,
        routeId: alert.routeId,
        busId: alert.busId,
      },
      sound: alert.type === "bus_arrived" ? "default" : true,
      priority:
        alert.type === "bus_arrived" || alert.type === "bus_delayed"
          ? Notifications.AndroidNotificationPriority.MAX
          : undefined,
    },
    trigger: null,
  });
}

/**
 * Call once at app start.
 */
export function useNotificationBootstrap() {
  useEffect(() => {
    configureNotificationHandler();
    void requestNotificationPermissions();
  }, []);
}

/**
 * Tracks whether the device can show phone push notifications.
 * When false, the map may show in-app alert banners as a fallback.
 */
export function usePushNotificationStatus() {
  const [status, setStatus] = useState(null);

  const refresh = useCallback(async () => {
    const next = await getNotificationPermissionStatus();
    setStatus(next);
    return next;
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    permissionStatus: status,
    pushGranted: status === "granted",
    showMapBannerFallback: status != null && status !== "granted",
    refresh,
  };
}

/**
 * Push + dedupe for alerts from NotificationsContext.
 */
export function useAlertPush(alerts, t) {
  const pushed = useRef(new Set());

  useEffect(() => {
    if (!alerts?.length) return;
    for (const alert of alerts) {
      if (!alert?.id || pushed.current.has(alert.id)) continue;
      if (!PUSH_NOTIFY_TYPES.has(alert.type)) continue;
      pushed.current.add(alert.id);
      const localized = localizeAlert(alert, t);
      void pushAlertNotification(localized);
    }
  }, [alerts, t]);
}
