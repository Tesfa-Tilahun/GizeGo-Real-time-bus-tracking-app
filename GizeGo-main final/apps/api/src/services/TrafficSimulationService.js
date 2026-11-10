import { notificationEmitter } from "./NotificationEmitter.js";

/**
 * Simulated traffic conditions per route (FR3 / FR5 / FR6).
 */
export class TrafficSimulationService {
  constructor() {
    /** @type {Map<string, { factor: number, level: string, congestion: number, updatedAt: string }>} */
    this.byRoute = new Map();
    this.timer = null;
  }

  start(routeIds = []) {
    for (const id of routeIds) this.ensureRoute(id);
    if (this.timer) return;
    this.timer = setInterval(() => this.randomizeAll(), 45_000);
  }

  ensureRoute(routeId) {
    if (!this.byRoute.has(routeId)) {
      this.byRoute.set(routeId, this.randomState());
    }
  }

  randomizeAll() {
    for (const routeId of this.byRoute.keys()) {
      const prev = this.byRoute.get(routeId);
      const target = this.randomState();
      const factor = prev
        ? Math.round((prev.factor * 0.82 + target.factor * 0.18) * 100) / 100
        : target.factor;
      let level = "light";
      if (factor >= 1.35) level = "heavy";
      else if (factor >= 1.05) level = "moderate";
      const next = {
        factor,
        level,
        congestion: target.congestion,
        updatedAt: new Date().toISOString(),
      };
      this.byRoute.set(routeId, next);
      if (prev && prev.level !== next.level && next.level === "heavy" && Math.random() < 0.25) {
        notificationEmitter.activateRouteAccident(
          routeId,
          12 + Math.floor(Math.random() * 15),
        );
      }
    }
  }

  randomState() {
    const congestion = Math.random();
    const factor = 0.55 + congestion * 1.45;
    let level = "light";
    if (factor >= 1.35) level = "heavy";
    else if (factor >= 1.05) level = "moderate";
    return {
      factor: Math.round(factor * 100) / 100,
      level,
      congestion: Math.round(congestion * 100) / 100,
      updatedAt: new Date().toISOString(),
    };
  }

  get(routeId) {
    this.ensureRoute(routeId);
    return this.byRoute.get(routeId);
  }

  /** Base urban speed m/s adjusted by traffic (default matches bus simulator). */
  effectiveSpeedMps(routeId, baseMps = 8.5) {
    const f = this.get(routeId)?.factor ?? 1;
    return baseMps / f;
  }
}

export const trafficSimulation = new TrafficSimulationService();
