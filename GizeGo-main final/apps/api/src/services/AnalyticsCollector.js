/**
 * In-memory time-series of fleet ticks for dashboard analytics (FR8).
 */
export class AnalyticsCollector {
  constructor(maxEntries = 4000) {
    this.entries = [];
    this.maxEntries = maxEntries;
  }

  /** @param {Array<object>} buses — public bus payloads from simulator */
  recordFromBuses(buses) {
    if (!buses?.length) return;
    const at = new Date().toISOString();
    for (const b of buses) {
      this.entries.push({
        at,
        routeId: b.routeId,
        busId: b.busId,
        busName: b.busName,
        status: b.status ?? "moving",
        etaMinutes: b.etaMinutes ?? null,
        speedKmh: b.speedKmh ?? null,
        trafficLevel: b.trafficLevel ?? "light",
      });
    }
    if (this.entries.length > this.maxEntries) {
      this.entries.splice(0, this.entries.length - this.maxEntries);
    }
  }

  query({ sinceMs, routeId, busId }) {
    const cutoff = Date.now() - sinceMs;
    return this.entries.filter((e) => {
      if (new Date(e.at).getTime() < cutoff) return false;
      if (routeId && e.routeId !== routeId) return false;
      if (busId && e.busId !== busId) return false;
      return true;
    });
  }
}

export const analyticsCollector = new AnalyticsCollector();
