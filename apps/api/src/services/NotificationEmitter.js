/**
 * Passenger alerts (delay + arrival only):
 * - Bus delayed on route
 * - Route accident / heavy traffic
 * - Missed arrival due to delay
 * - Bus arrived at passenger stop
 */
const ARRIVED_RADIUS_METERS = 120;

export class NotificationEmitter {
  /**
   * @param {import("socket.io").Server | null} io
   */
  constructor(io) {
    this.io = io;
    /** @type {Set<string>} */
    this.recentKeys = new Set();
    /** @type {Map<string, { waitMinutes: number }>} */
    this.routeAccidents = new Map();
  }

  attach(io) {
    this.io = io;
  }

  dedupeKey(key, ttlMs = 30 * 60_000) {
    if (this.recentKeys.has(key)) return false;
    this.recentKeys.add(key);
    setTimeout(() => this.recentKeys.delete(key), ttlMs);
    return true;
  }

  emitToSocket(socket, payload) {
    if (!socket) return;
    socket.emit("notification:alert", { ...payload, at: new Date().toISOString() });
  }

  emitToRoute(routeId, payload) {
    if (!this.io || !routeId) return;
    this.io.to(`route:${routeId}`).emit("notification:alert", {
      ...payload,
      at: new Date().toISOString(),
    });
  }

  isPastScheduledArrival(hhmm, graceMinutes = 2) {
    if (!hhmm || typeof hhmm !== "string") return false;
    const parts = hhmm.trim().slice(0, 5).split(":");
    const h = Number(parts[0]);
    const m = Number(parts[1] ?? 0);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return false;
    const now = new Date();
    const sched = new Date(now);
    sched.setHours(h, m, 0, 0);
    return now.getTime() - sched.getTime() >= graceMinutes * 60_000;
  }

  initRouteWatch(socket, routeId, { etaMinutes = null, stopName = null } = {}) {
    if (!socket?.data) return;
    socket.data.routeWatch = {
      routeId,
      stopName: stopName ?? null,
      initialEtaMinutes: Number.isFinite(etaMinutes) && etaMinutes > 0 ? etaMinutes : null,
      arrivedSent: false,
      delaySent: false,
    };
  }

  clearRouteWatch(socket) {
    if (socket?.data) delete socket.data.routeWatch;
  }

  onRouteSubscribe(socket, routeId, meta = {}) {
    const existing = socket?.data?.routeWatch;
    const sameRoute = existing?.routeId === routeId;

    if (sameRoute) {
      if (meta.stopName) existing.stopName = meta.stopName;
      if (
        Number.isFinite(meta.etaMinutes) &&
        meta.etaMinutes > 0 &&
        !existing.initialEtaMinutes
      ) {
        existing.initialEtaMinutes = meta.etaMinutes;
      }
      return;
    }

    this.initRouteWatch(socket, routeId, meta);
  }

  updateRouteWatch(socket, routeId, meta = {}) {
    const watch = socket?.data?.routeWatch;
    if (!watch || watch.routeId !== routeId) return;
    if (meta.stopName) watch.stopName = meta.stopName;
    if (
      Number.isFinite(meta.etaMinutes) &&
      meta.etaMinutes > 0 &&
      !watch.initialEtaMinutes
    ) {
      watch.initialEtaMinutes = meta.etaMinutes;
    }
  }

  emitBusDelayed(socket, bus, etaMinutes, stopName) {
    const watch = socket?.data?.routeWatch;
    if (watch?.delaySent) return;
    if (watch) watch.delaySent = true;

    const dk = `delay:${bus.busId}:${socket?.id ?? "route"}`;
    if (!this.dedupeKey(dk, 30 * 60_000)) return;

    this.emitToSocket(socket, {
      type: "bus_delayed",
      severity: "warning",
      title: "Bus delayed",
      message: stopName
        ? `${bus.busName} is delayed reaching ${stopName}. ETA ~${etaMinutes} min.`
        : `${bus.busName} is delayed. ETA ~${etaMinutes} min.`,
      busId: bus.busId,
      busName: bus.busName,
      routeId: bus.routeId,
      stopName,
      etaMinutes,
      replacePrevious: false,
    });
  }

  emitBusArrived(socket, bus, stopName = null) {
    const watch = socket?.data?.routeWatch;
    if (watch?.arrivedSent) return;
    if (watch) watch.arrivedSent = true;

    const dk = `arrived:${bus.busId}:${socket?.id ?? "route"}`;
    if (!this.dedupeKey(dk, 20 * 60_000)) return;

    this.emitToSocket(socket, {
      type: "bus_arrived",
      severity: "info",
      title: "Bus arrived",
      message: stopName
        ? `${bus.busName} is at ${stopName} now.`
        : `${bus.busName} is at your stop now.`,
      busId: bus.busId,
      busName: bus.busName,
      routeId: bus.routeId,
      stopName,
      etaMinutes: 0,
      replacePrevious: true,
    });
  }

  activateRouteAccident(routeId, waitMinutes = 20) {
    this.routeAccidents.set(routeId, { waitMinutes });
    const dk = `accident-active:${routeId}`;
    if (!this.dedupeKey(dk, 30 * 60_000)) return;
    this.emitToRoute(routeId, {
      type: "route_accident",
      severity: "error",
      title: "Accident / heavy traffic",
      message: `Possible accident or heavy traffic on this route. Expect delays of ~${waitMinutes} min.`,
      routeId,
      waitMinutes,
      replacePrevious: false,
    });
  }

  /** ETA and distance from bus to passenger GPS (when shared). */
  passengerProximity(bus, lastLocation) {
    if (!lastLocation?.latitude || !lastLocation?.longitude) {
      return { etaMinutes: bus.etaMinutes ?? 99, distanceMeters: null };
    }
    const distanceMeters = haversineMeters(lastLocation, {
      latitude: bus.latitude,
      longitude: bus.longitude,
    });
    const speedMps = Math.max(1.5, ((bus.speedKmh ?? 25) * 1000) / 3600);
    const etaMinutes = Math.max(0, Math.round(distanceMeters / speedMps / 60));
    return { etaMinutes, distanceMeters };
  }

  isBusAtPassenger(bus, lastLocation) {
    const { distanceMeters, etaMinutes } = this.passengerProximity(bus, lastLocation);
    if (distanceMeters == null) return etaMinutes <= 0;
    return distanceMeters <= ARRIVED_RADIUS_METERS || (distanceMeters <= 200 && etaMinutes <= 0);
  }

  pickBusForWatch(buses, lastLocation) {
    if (!buses?.length) return null;
    if (!lastLocation) {
      return [...buses].sort((a, b) => (a.etaMinutes ?? 99) - (b.etaMinutes ?? 99))[0];
    }
    let best = null;
    let bestScore = Infinity;
    for (const bus of buses) {
      const dist = haversineMeters(lastLocation, {
        latitude: bus.latitude,
        longitude: bus.longitude,
      });
      const score = dist + (bus.etaMinutes ?? 99) * 200;
      if (score < bestScore) {
        bestScore = score;
        best = { ...bus, distanceMeters: Math.round(dist) };
      }
    }
    return best;
  }

  /** Called each simulation tick for every passenger watching a route. */
  processRouteWatchers(io, getBusesForRoute) {
    if (!io) return;
    for (const socket of io.sockets.sockets.values()) {
      const watch = socket.data?.routeWatch;
      if (!watch?.routeId) continue;

      const buses = getBusesForRoute(watch.routeId) ?? [];
      const lastLocation = socket.data?.lastLocation;
      const bus = this.pickBusForWatch(buses, lastLocation);
      if (!bus) continue;

      const { etaMinutes: etaToPassenger } = this.passengerProximity(bus, lastLocation);
      const eta = lastLocation ? etaToPassenger : (bus.etaMinutes ?? 99);
      const stopName = watch.stopName;

      if (!watch.arrivedSent && this.isBusAtPassenger(bus, lastLocation)) {
        this.emitBusArrived(socket, bus, stopName);
      } else if (!watch.delaySent && bus.status === "delayed") {
        this.emitBusDelayed(socket, bus, Math.max(1, eta), stopName);
      }

      const accident = this.routeAccidents.get(watch.routeId);
      if (accident && eta > 1) {
        const missedSchedule =
          bus.scheduledArrivalTime && this.isPastScheduledArrival(bus.scheduledArrivalTime);
        const badlyDelayed = bus.status === "delayed" && eta >= 4;
        if (missedSchedule || badlyDelayed) {
          const dk = `accident-missed:${watch.routeId}:${socket.id}`;
          if (this.dedupeKey(dk, 45 * 60_000)) {
            const timeLabel = bus.scheduledArrivalTime ?? "expected time";
            this.emitToSocket(socket, {
              type: "accident_missed_arrival",
              severity: "error",
              title: "Accident — bus delayed",
              message: `${bus.busName} has not arrived by ${timeLabel} due to a possible accident. Please wait ~${accident.waitMinutes} min.`,
              busId: bus.busId,
              busName: bus.busName,
              routeId: bus.routeId,
              scheduledArrivalTime: bus.scheduledArrivalTime,
              waitMinutes: accident.waitMinutes,
              etaMinutes: eta,
              replacePrevious: false,
            });
          }
        }
      }
    }
  }

  onBusUpdate(_bus) {
    /* Per-passenger logic runs in processRouteWatchers. */
  }
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

export const notificationEmitter = new NotificationEmitter();
