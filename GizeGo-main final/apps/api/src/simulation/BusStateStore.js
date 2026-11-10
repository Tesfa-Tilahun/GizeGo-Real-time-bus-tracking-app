/**
 * In-memory store for live simulated bus state (FR3 / FR4).
 * Single source of truth for REST + WebSocket consumers.
 */
export class BusStateStore {
  constructor() {
    /** @type {Map<string, object>} key = busId:routeId */
    this.buses = new Map();
    /** @type {Map<string, { id, name, polyline, stops, distanceMeters }>} */
    this.routes = new Map();
    this.lastFleetEmit = null;
  }

  setRoute(routeId, meta) {
    this.routes.set(routeId, meta);
  }

  setBus(key, state) {
    this.buses.set(key, state);
  }

  deleteBus(key) {
    this.buses.delete(key);
  }

  getPublicFleet() {
    const byRoute = new Map();
    for (const bus of this.buses.values()) {
      if (!bus.public) continue;
      const list = byRoute.get(bus.public.routeId) ?? [];
      list.push(bus.public);
      byRoute.set(bus.public.routeId, list);
    }
    const routes = [...this.routes.values()].map((r) => ({
      routeId: r.id,
      routeName: r.name,
      polyline: r.polyline,
      stops: r.stops,
      distanceMeters: r.distanceMeters,
      buses: byRoute.get(r.id) ?? [],
    }));
    return {
      updatedAt: new Date().toISOString(),
      busCount: [...this.buses.values()].filter((b) => b.public).length,
      routes,
      buses: [...this.buses.values()].map((b) => b.public).filter(Boolean),
    };
  }

  getBusesForRoute(routeId) {
    return [...this.buses.values()]
      .map((b) => b.public)
      .filter((b) => b && b.routeId === routeId);
  }

  findNearby(lat, lng, radiusM) {
    const out = [];
    for (const bus of this.buses.values()) {
      if (!bus.public) continue;
      const d = haversine({ latitude: lat, longitude: lng }, bus.public);
      if (d <= radiusM) out.push({ ...bus.public, distanceMeters: Math.round(d) });
    }
    return out.sort((a, b) => a.distanceMeters - b.distanceMeters);
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

export const busStateStore = new BusStateStore();
