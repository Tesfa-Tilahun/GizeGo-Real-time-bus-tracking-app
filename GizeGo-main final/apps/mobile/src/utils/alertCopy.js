/** Localize passenger notification payloads. */
export function localizeAlert(payload, t) {
  if (!payload || !t) return payload;

  const bus = payload.busName ?? payload.busId ?? "Bus";
  const wait = payload.waitMinutes;
  const time = payload.scheduledArrivalTime ?? "";
  const eta = payload.etaMinutes;
  const stop = payload.stopName ?? "";

  const type = payload.type;
  let title = payload.title;
  let message = payload.message;

  switch (type) {
    case "bus_arrived":
      title = t("notify.busArrivedTitle");
      message = stop
        ? t("notify.busArrivedStopMsg", { bus, stop })
        : t("notify.busArrivedMsg", { bus });
      break;
    case "bus_delayed":
      title = t("notify.busDelayedTitle");
      message = stop
        ? t("notify.busDelayedStopMsg", { bus, min: eta ?? "?", stop })
        : t("notify.busDelayedMsg", { bus, min: eta ?? "?" });
      break;
    case "accident_missed_arrival":
      title = t("notify.accidentTitle");
      message = t("notify.accidentMsg", { bus, time, wait: wait ?? "?" });
      break;
    case "route_accident":
      title = t("notify.routeAccidentTitle");
      message = t("notify.routeAccidentMsg", { wait: wait ?? "?" });
      break;
    default:
      return null;
  }

  return { ...payload, title, message };
}
