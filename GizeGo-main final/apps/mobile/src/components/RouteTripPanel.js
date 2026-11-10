import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocale } from "../context/LocaleContext.js";
import { colors } from "../theme/colors.js";
import { formatKmOneDecimal } from "../utils/travelMetrics.js";

function BusRow({ bus, t }) {
  if (bus.availableNow) {
    return (
      <View style={styles.busRow}>
        <View style={styles.busRowMain}>
          <Text style={styles.busName}>{bus.name}</Text>
          <View style={styles.badgeLive}>
            <Text style={styles.badgeLiveTxt}>{t("trip.busAvailableNow")}</Text>
          </View>
        </View>
        <Text style={styles.busEta}>
          {t("trip.busEtaLive", { min: bus.etaMinutes ?? "—" })}
          {bus.status ? ` · ${t(`map.status.${bus.status}`)}` : ""}
        </Text>
        {bus.scheduleLabel ? (
          <Text style={styles.busSchedule}>{bus.scheduleLabel}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.busRow}>
      <View style={styles.busRowMain}>
        <Text style={styles.busName}>{bus.name}</Text>
        <View style={styles.badgeWait}>
          <Text style={styles.badgeWaitTxt}>{t("trip.busNotOnRoute")}</Text>
        </View>
      </View>
      {bus.minutesUntilDeparture != null ? (
        <Text style={styles.busEta}>
          {t("trip.busArrivesIn", { min: bus.minutesUntilDeparture })}
        </Text>
      ) : null}
      {bus.departureTime ? (
        <Text style={styles.busSchedule}>
          {t("trip.busNextDeparture", { time: bus.departureTime })}
          {bus.arrivalTime ? ` → ${bus.arrivalTime}` : ""}
        </Text>
      ) : (
        <Text style={styles.busScheduleMuted}>{t("trip.noSchedule")}</Text>
      )}
      {bus.departureStopName && bus.arrivalStopName ? (
        <Text style={styles.busStops} numberOfLines={1}>
          {bus.departureStopName} → {bus.arrivalStopName}
        </Text>
      ) : null}
    </View>
  );
}

function ProgressBar({ percent, t }) {
  const pct = Math.max(0, Math.min(100, percent ?? 0));
  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.progressLabel}>{t("map.progressPct", { pct: Math.round(pct) })}</Text>
    </View>
  );
}

/**
 * Google Maps–style route result: fare, live buses, stop ETAs, bus progress.
 */
export function RouteTripPanel({
  info,
  tripFrom,
  tripTo,
  liveBusCount,
  trackedBus = null,
  nextStop = null,
  pathMinutes = null,
  pathKm = null,
  compact = false,
}) {
  const { t } = useLocale();
  if (!info) return null;

  const km = pathKm ?? formatKmOneDecimal(info.distanceMeters);
  const liveCount = liveBusCount ?? info.liveBusCount ?? 0;

  return (
    <View style={[styles.panel, compact && styles.panelCompact]}>
      {tripFrom && tripTo ? (
        <Text style={styles.tripLine} numberOfLines={2}>
          {tripFrom} → {tripTo}
        </Text>
      ) : null}

      {!compact ? (
        <Text style={styles.routeName} numberOfLines={2}>
          {info.routeName}
        </Text>
      ) : null}

      <View style={styles.metaRow}>
        {info.price != null ? (
          <View style={styles.priceChip}>
            <Text style={styles.priceLbl}>{t("trip.fare")}</Text>
            <Text style={styles.priceVal}>{t("home.etbShort", { price: info.price })}</Text>
          </View>
        ) : null}
        {km ? <Text style={styles.metaTxt}>{t("map.fmtKm", { km })}</Text> : null}
        {pathMinutes != null ? (
          <Text style={styles.metaTxt}>{t("map.fmtEta", { min: pathMinutes })}</Text>
        ) : null}
        {info.stopEtas?.length > 0 ? (
          <Text style={styles.metaTxt}>
            {t("routesBrowse.stopsLabel", { count: info.stopEtas.length })}
          </Text>
        ) : null}
      </View>

      {trackedBus ? (
        <View style={styles.liveBlock}>
          <Text style={styles.liveTitle}>{trackedBus.busName}</Text>
          {trackedBus.status === "arrived" || trackedBus.etaMinutes === 0 ? (
            <Text style={styles.liveEta}>{t("map.busArrived")}</Text>
          ) : (
            <Text style={styles.liveEta}>
              {t("map.tripProgress", {
                pct: trackedBus.progressPercent ?? 0,
                km: formatKmOneDecimal(trackedBus.remainingMeters),
                min: trackedBus.etaMinutes ?? "—",
              })}
            </Text>
          )}
          <ProgressBar percent={trackedBus.progressPercent} t={t} />
          {nextStop ? (
            <Text style={styles.nextStop}>{t("map.nextStop", { name: nextStop.name })}</Text>
          ) : null}
        </View>
      ) : null}

      <Text style={styles.availabilityTitle}>
        {liveCount > 0
          ? t("trip.busesAvailableCount", { count: liveCount })
          : t("trip.noBusLiveNow")}
      </Text>

      {info.buses?.length > 0 ? (
        <View style={styles.busList}>
          {info.buses.map((bus) => (
            <BusRow key={bus.id} bus={bus} t={t} />
          ))}
        </View>
      ) : (
        <Text style={styles.emptyBuses}>{t("trip.noBusesAssigned")}</Text>
      )}

      {info.stopEtas?.length > 0 ? (
        <View style={styles.stopBlock}>
          <Text style={styles.stopTitle}>{t("map.stopEtasTitle")}</Text>
          {info.stopEtas.slice(0, 4).map((s) => (
            <Text key={s.stopId} style={styles.stopRow} numberOfLines={1}>
              {s.stopName}
              {s.etaMinutes != null ? ` · ${t("map.fmtEta", { min: s.etaMinutes })}` : ""}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    paddingBottom: 8,
  },
  panelCompact: {
    paddingBottom: 4,
  },
  tripLine: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.accentBlue,
    marginBottom: 8,
  },
  routeName: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.textDark,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 10,
    gap: 10,
  },
  priceChip: {
    backgroundColor: "#e8f5e9",
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#a5d6a7",
  },
  priceLbl: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
  },
  priceVal: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1b5e20",
  },
  metaTxt: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textDark,
  },
  liveBlock: {
    backgroundColor: "#e3f2fd",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  liveTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.textDark,
  },
  liveEta: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1565c0",
    marginTop: 4,
  },
  progressWrap: {
    marginTop: 8,
  },
  progressTrack: {
    height: 6,
    backgroundColor: "#bbdefb",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#1565c0",
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textMuted,
    marginTop: 4,
  },
  nextStop: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textDark,
    marginTop: 6,
  },
  availabilityTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textDark,
    marginBottom: 8,
  },
  busList: {
    marginBottom: 8,
  },
  busRow: {
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e0e0e0",
  },
  busRowMain: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  busName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textDark,
    flex: 1,
    marginRight: 8,
  },
  badgeLive: {
    backgroundColor: "#e8f5e9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeLiveTxt: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2e7d32",
  },
  badgeWait: {
    backgroundColor: "#fff3e0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeWaitTxt: {
    fontSize: 11,
    fontWeight: "700",
    color: "#e65100",
  },
  busEta: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1565c0",
  },
  busSchedule: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textDark,
    marginTop: 2,
  },
  busScheduleMuted: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  busStops: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  emptyBuses: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: "italic",
    marginBottom: 8,
  },
  stopBlock: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#ddd",
  },
  stopTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.textMuted,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  stopRow: {
    fontSize: 12,
    color: colors.textDark,
    marginBottom: 2,
  },
});
