import { decodePolyline, pointAlongPath, pathTotalMeters } from "../shared/utils/polyline.js";
import { trafficSimulation } from "./TrafficSimulationService.js";
import { notificationEmitter } from "./NotificationEmitter.js";
import { analyticsCollector } from "./AnalyticsCollector.js";
import { advanceBusAlongPath, initialBusProgress } from "../shared/utils/busMotion.js";
import { routeDebug } from "../shared/utils/routeDebug.js";

const MIN_TICK_MS = 2000;
const MAX_TICK_MS = 5000;
const BASE_SPEED_MPS = 8.5;

/**
 * FR3 + FR4: 10–20 virtual buses, GPS every 2–5s, traffic-aware speed, status, WebSocket updates.
 */
export class BusTrackingSimulator {
  /**
   * @param {import("pg").Pool | null} pool
   * @param {import("socket.io").Server} io
   */
  constructor(pool, io) {
    this.pool = pool;
    this.io = io;
    /** @type {Map<string, object>} */
    this.state = new Map();
    this.timer = null;
    this.lastFleetRefreshAt = 0;
    notificationEmitter.attach(io);
  }

  start() {
    if (this.timer) return;
    void this.refreshFleet().then(() => {
      this.lastFleetRefreshAt = Date.now();
    });
    this.scheduleNextTick();
  }

  stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  scheduleNextTick() {
    const delay = MIN_TICK_MS + Math.floor(Math.random() * (MAX_TICK_MS - MIN_TICK_MS));
    this.lastScheduledTickMs = delay;
    this.timer = setTimeout(() => {
      void this.tick(this.lastScheduledTickMs).finally(() => this.scheduleNextTick());
    }, delay);
  }

  async refreshFleet() {
    if (!this.pool) return;

    const { rows } = await this.pool.query(
      `SELECT b.id AS bus_id, b.name AS bus_name, br.route_id, br.arrival_time::text AS arrival_time,
              r.polyline, r.distance_meters
       FROM bus_routes br
       INNER JOIN buses b ON b.id = br.bus_id
       INNER JOIN routes r ON r.id = br.route_id
       ORDER BY br.route_id, b.name`,
    );

    const routeIds = new Set();
    const seen = new Set();

    for (const row of rows) {
      routeIds.add(row.route_id);
      const key = `${row.bus_id}:${row.route_id}`;
      seen.add(key);
      trafficSimulation.ensureRoute(row.route_id);

      if (this.state.has(key)) {
        const existing = this.state.get(key);
        existing.scheduledArrivalTime = row.arrival_time ?? existing.scheduledArrivalTime;
        continue;
      }

      let path = decodePolyline(row.polyline);
      if (path.length < 2) {
        const stops = await this.pool.query(
          `SELECT latitude, longitude FROM stops WHERE route_id = $1 ORDER BY sequence_order`,
          [row.route_id],
        );
        path = stops.rows.map((s) => ({
          latitude: Number(s.latitude),
          longitude: Number(s.longitude),
        }));
      }

      let totalMeters = pathTotalMeters(path);
      const dm = row.distance_meters != null ? parseFloat(row.distance_meters) : null;
      if (Number.isFinite(dm) && dm > 0 && Math.abs(dm - totalMeters) / dm < 0.25) {
        totalMeters = dm;
      }

      this.state.set(key, {
        progress: initialBusProgress(row.bus_id),
        path,
        totalMeters: Math.max(totalMeters, 1),
        busId: row.bus_id,
        busName: row.bus_name,
        routeId: row.route_id,
        scheduledArrivalTime: row.arrival_time ?? null,
        speedMps: BASE_SPEED_MPS,
        trail: [],
        lastTickMs: MIN_TICK_MS,
      });
    }

    trafficSimulation.start([...routeIds]);

    for (const key of [...this.state.keys()]) {
      if (!seen.has(key)) this.state.delete(key);
    }
  }

  getBusesForRoute(routeId) {
    const out = [];
    for (const bus of this.state.values()) {
      if (bus.routeId === routeId) out.push(this.toPublicBus(bus));
    }
    return out;
  }

  getAllPublicBuses() {
    return [...this.state.values()].map((b) => this.toPublicBus(b));
  }

  findNearby(latitude, longitude, radiusMeters = 8000) {
    const out = [];
    for (const bus of this.state.values()) {
      const pub = this.toPublicBus(bus);
      const d = haversine(
        { latitude, longitude },
        { latitude: pub.latitude, longitude: pub.longitude },
      );
      if (d <= radiusMeters) {
        out.push({ ...pub, distanceMeters: Math.round(d) });
      }
    }
    return out.sort((a, b) => a.distanceMeters - b.distanceMeters);
  }

  toPublicBus(bus) {
    const sample = pointAlongPath(bus.path, bus.progress);
    const traffic = trafficSimulation.get(bus.routeId);
    const speedKmh = Math.round(bus.speedMps * 3.6 * 10) / 10;
    const remaining = bus.remainingMeters ?? sample?.remainingMeters ?? 0;
    const traveled = bus.traveledMeters ?? sample?.traveledMeters ?? 0;
    const total = bus.totalPathMeters ?? bus.totalMeters ?? sample?.totalMeters ?? 1;
    return {
      busId: bus.busId,
      busName: bus.busName,
      routeId: bus.routeId,
      latitude: sample?.point.latitude ?? bus.path[0]?.latitude,
      longitude: sample?.point.longitude ?? bus.path[0]?.longitude,
      heading: sample?.headingDeg ?? 0,
      progress: bus.progress,
      progressPercent: Math.round(Math.max(0, Math.min(1, bus.progress)) * 1000) / 10,
      speedMps: Math.round(bus.speedMps * 100) / 100,
      speedKmh,
      status: bus.status ?? "moving",
      etaMinutes: bus.etaMinutes ?? 0,
      remainingMeters: Math.round(remaining),
      traveledMeters: Math.round(traveled),
      totalMeters: Math.round(total),
      scheduledArrivalTime: bus.scheduledArrivalTime ?? null,
      trafficLevel: traffic?.level ?? "light",
      trail: bus.trail ?? [],
      updatedAt: new Date().toISOString(),
    };
  }

  async tick(tickMs = MIN_TICK_MS) {
    const now = Date.now();
    if (now - this.lastFleetRefreshAt >= 60_000) {
      await this.refreshFleet();
      this.lastFleetRefreshAt = now;
    }

    /** @type {Map<string, object[]>} */
    const byRoute = new Map();

    for (const bus of this.state.values()) {
      if (!bus.path?.length) continue;

      const traffic = trafficSimulation.get(bus.routeId);
      const speedMps = trafficSimulation.effectiveSpeedMps(bus.routeId, BASE_SPEED_MPS);
      bus.lastTickMs = tickMs;

      advanceBusAlongPath(bus, tickMs, speedMps, traffic.factor);

      const sample = bus.lastSample;
      if (!sample) continue;

      routeDebug("bus-tick", {
        busId: bus.busId,
        routeId: bus.routeId,
        progress: Math.round(bus.progress * 1000) / 1000,
        remainingM: bus.remainingMeters,
        traveledM: bus.traveledMeters,
        etaMin: bus.etaMinutes,
        speedKmh: Math.round(bus.speedMps * 3.6),
      });

      const payload = this.toPublicBus(bus);
      notificationEmitter.onBusUpdate(payload);

      const list = byRoute.get(bus.routeId) ?? [];
      list.push(payload);
      byRoute.set(bus.routeId, list);
    }

    for (const [routeId, buses] of byRoute) {
      const traffic = trafficSimulation.get(routeId);
      this.io.to(`route:${routeId}`).emit("bus:locations", {
        routeId,
        buses,
        traffic,
        simulation: true,
      });
      this.io.to(`route:${routeId}`).emit("traffic:update", { routeId, traffic });
    }

    const allBuses = [...byRoute.values()].flat();
    if (allBuses.length > 0) {
      this.io.emit("bus:locations", { routeId: null, buses: allBuses, simulation: true });
      analyticsCollector.recordFromBuses(allBuses);
    }

    notificationEmitter.processRouteWatchers(this.io, (routeId) => this.getBusesForRoute(routeId));
  }
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
