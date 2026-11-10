import { trafficSimulation } from "./TrafficSimulationService.js";

const PERIOD_MS = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

function periodToMs(period) {
  return PERIOD_MS[period] ?? PERIOD_MS["24h"];
}

function avg(nums) {
  const valid = nums.filter((n) => Number.isFinite(n));
  if (!valid.length) return null;
  return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10;
}

function hourBucket(iso) {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, "0")}:00`;
}

export class AdminAnalyticsService {
  constructor(pool, getLiveBuses, analyticsCollector, routeRepository, feedbackRepository = null) {
    this.pool = pool;
    this.getLiveBuses = getLiveBuses;
    this.analyticsCollector = analyticsCollector;
    this.routeRepository = routeRepository;
    this.feedbackRepository = feedbackRepository;
  }

  async getDashboard(filters = {}) {
    const period = filters.period ?? "24h";
    const sinceMs = periodToMs(period);
    const routeId = filters.routeId || null;
    const busId = filters.busId || null;

    const [routes, fleetRows] = await Promise.all([
      this.routeRepository.listSummaries(),
      this.pool
        ? this.pool.query(
            `SELECT b.id AS bus_id, b.name AS bus_name, b.operator,
                    br.route_id, r.name AS route_name, r.duration_minutes
             FROM buses b
             LEFT JOIN bus_routes br ON br.bus_id = b.id
             LEFT JOIN routes r ON r.id = br.route_id
             ORDER BY b.name`,
          )
        : Promise.resolve({ rows: [] }),
    ]);

    const routeNameById = Object.fromEntries(routes.map((r) => [r.id, r.name]));
    const durationByRoute = Object.fromEntries(
      routes.map((r) => [r.id, r.durationMinutes ?? null]),
    );

    let liveBuses = this.getLiveBuses?.() ?? [];
    if (routeId) liveBuses = liveBuses.filter((b) => b.routeId === routeId);
    if (busId) liveBuses = liveBuses.filter((b) => b.busId === busId);

    const snapshots = this.analyticsCollector.query({ sinceMs, routeId, busId });

    const moving = liveBuses.filter((b) => b.status === "moving").length;
    const delayed = liveBuses.filter((b) => b.status === "delayed").length;
    const stopped = liveBuses.filter((b) => b.status === "stopped").length;

    const congestionBreakdown = { light: 0, moderate: 0, heavy: 0 };
    for (const b of liveBuses) {
      const lvl = b.trafficLevel ?? "light";
      if (congestionBreakdown[lvl] != null) congestionBreakdown[lvl] += 1;
    }
    for (const s of snapshots) {
      /* historical congestion counted in patterns chart */
    }

    const travelTimeByRoute = {};
    for (const s of snapshots) {
      if (!s.routeId) continue;
      if (!travelTimeByRoute[s.routeId]) {
        travelTimeByRoute[s.routeId] = { etas: [], delays: 0, count: 0 };
      }
      travelTimeByRoute[s.routeId].count += 1;
      if (s.etaMinutes != null) travelTimeByRoute[s.routeId].etas.push(s.etaMinutes);
      if (s.status === "delayed") travelTimeByRoute[s.routeId].delays += 1;
    }

    const avgTravelTimeByRoute = Object.entries(travelTimeByRoute).map(([id, v]) => ({
      routeId: id,
      routeName: routeNameById[id] ?? id,
      avgEtaMinutes: avg(v.etas),
      scheduledMinutes: durationByRoute[id] ?? null,
      delayEvents: v.delays,
      samples: v.count,
    }));

    avgTravelTimeByRoute.sort((a, b) => (b.samples ?? 0) - (a.samples ?? 0));

    const delayByHour = {};
    const congestionByHour = {};
    for (const s of snapshots) {
      const h = hourBucket(s.at);
      if (s.status === "delayed") {
        delayByHour[h] = (delayByHour[h] ?? 0) + 1;
      }
      const lvl = s.trafficLevel ?? "light";
      if (!congestionByHour[h]) congestionByHour[h] = { light: 0, moderate: 0, heavy: 0 };
      if (congestionByHour[h][lvl] != null) congestionByHour[h][lvl] += 1;
    }

    const delayTrend = Object.entries(delayByHour)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([hour, count]) => ({ hour, delays: count }));

    const congestionTrend = Object.entries(congestionByHour)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([hour, levels]) => ({
        hour,
        light: levels.light ?? 0,
        moderate: levels.moderate ?? 0,
        heavy: levels.heavy ?? 0,
      }));

    const routeTraffic = routes
      .filter((r) => !routeId || r.id === routeId)
      .slice(0, 20)
      .map((r) => {
        const t = trafficSimulation.get(r.id);
        return {
          routeId: r.id,
          routeName: r.name,
          trafficLevel: t?.level ?? "light",
          trafficFactor: t?.factor ?? 1,
        };
      });

    const fleetStatus = liveBuses.map((b) => ({
      busId: b.busId,
      busName: b.busName,
      routeId: b.routeId,
      routeName: routeNameById[b.routeId] ?? "—",
      status: b.status,
      speedKmh: b.speedKmh,
      etaMinutes: b.etaMinutes,
      trafficLevel: b.trafficLevel,
      updatedAt: b.updatedAt,
    }));

    const allBuses = fleetRows.rows.map((row) => ({
      busId: row.bus_id,
      busName: row.bus_name,
      operator: row.operator,
      routeId: row.route_id,
      routeName: row.route_name,
      scheduledMinutes: row.duration_minutes,
    }));

    const filteredBusOptions = busId
      ? allBuses.filter((b) => b.busId === busId)
      : routeId
        ? allBuses.filter((b) => b.routeId === routeId)
        : allBuses;

    let feedbackAnalytics = {
      total: 0,
      pending: 0,
      accepted: 0,
      rejected: 0,
      avgRating: null,
      byCategory: [],
      byRating: [],
      trend: [],
    };
    if (this.feedbackRepository) {
      try {
        feedbackAnalytics = await this.feedbackRepository.getAnalytics({
          sinceMs,
          routeId,
        });
      } catch {
        /* feedback table may be unavailable */
      }
    }

    return {
      generatedAt: new Date().toISOString(),
      filters: { period, routeId, busId },
      summary: {
        totalLive: liveBuses.length,
        moving,
        delayed,
        stopped,
        avgTravelTimeMinutes: avg(snapshots.map((s) => s.etaMinutes)),
        avgSpeedKmh: avg(snapshots.map((s) => s.speedKmh)),
        congestionBreakdown,
        snapshotCount: snapshots.length,
        feedbackTotal: feedbackAnalytics.total,
        feedbackPending: feedbackAnalytics.pending,
        feedbackAccepted: feedbackAnalytics.accepted,
        feedbackRejected: feedbackAnalytics.rejected,
        feedbackAvgRating: feedbackAnalytics.avgRating,
      },
      fleetStatus,
      charts: {
        avgTravelTimeByRoute: avgTravelTimeByRoute.slice(0, 12),
        delayTrend,
        congestionTrend,
        congestionPie: [
          { name: "Light", value: congestionBreakdown.light, level: "light" },
          { name: "Moderate", value: congestionBreakdown.moderate, level: "moderate" },
          { name: "Heavy", value: congestionBreakdown.heavy, level: "heavy" },
        ],
        routeTraffic,
        feedbackByCategory: feedbackAnalytics.byCategory,
        feedbackByRating: feedbackAnalytics.byRating.map((r) => ({
          rating: `${r.rating}★`,
          count: r.count,
        })),
        feedbackTrend: feedbackAnalytics.trend,
      },
      filterOptions: {
        routes: routes.map((r) => ({ id: r.id, name: r.name })),
        buses: filteredBusOptions.map((b) => ({
          id: b.busId,
          name: b.busName,
          routeId: b.routeId,
        })),
        periods: [
          { id: "1h", label: "Last hour" },
          { id: "24h", label: "Last 24 hours" },
          { id: "7d", label: "Last 7 days" },
          { id: "30d", label: "Last 30 days" },
        ],
      },
    };
  }

  async getReport(filters = {}) {
    const dashboard = await this.getDashboard(filters);
    return {
      reportType: "operational_performance",
      title: "GizeGo System Performance & Operations Report",
      ...dashboard,
      recommendations: this.buildRecommendations(dashboard),
    };
  }

  buildRecommendations(dashboard) {
    const recs = [];
    const { summary, charts } = dashboard;
    if (summary.delayed > summary.moving) {
      recs.push("High delay ratio — review schedules on congested routes.");
    }
    if (summary.congestionBreakdown.heavy > 3) {
      recs.push("Multiple routes under heavy traffic — consider fleet redistribution.");
    }
    const worst = charts.avgTravelTimeByRoute?.[0];
    if (worst?.avgEtaMinutes > (worst?.scheduledMinutes ?? 999) * 1.3) {
      recs.push(`Route "${worst.routeName}" exceeds scheduled time — investigate delays.`);
    }
    if (recs.length === 0) {
      recs.push("Fleet operating within normal parameters.");
    }
    if (dashboard.summary?.feedbackPending > 5) {
      recs.push(`${dashboard.summary.feedbackPending} passenger feedback items awaiting review.`);
    }
    if (dashboard.summary?.feedbackAvgRating != null && dashboard.summary.feedbackAvgRating < 3) {
      recs.push("Average passenger rating is below 3 — review recent feedback.");
    }
    return recs;
  }
}
