import { notificationEmitter } from "../services/NotificationEmitter.js";

/** Simulated traffic per route — affects speed and delay status (FR3 / FR5 / FR6). */
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
      const next = this.randomState();
      const prev = this.byRoute.get(routeId);
      this.byRoute.set(routeId, next);
      if (prev && prev.level !== next.level) {
        notificationEmitter.onTrafficChange(routeId, next);
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

  effectiveSpeedMps(routeId, baseMps = 8.5) {
    return baseMps / (this.get(routeId)?.factor ?? 1);
  }
}

export const trafficSimulation = new TrafficSimulationService();
