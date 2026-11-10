import { decodePolyline, encodePolyline, pathTotalMeters } from "../shared/utils/polyline.js";
import { AppError } from "../shared/errors/AppError.js";

const DEFAULT_OSRM = "https://router.project-osrm.org";

/**
 * Road geometry from OpenStreetMap via OSRM (public demo server).
 */
export class OsmRoutingService {
  constructor(baseUrl = process.env.OSRM_BASE_URL?.trim() || DEFAULT_OSRM) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  /**
   * Up to `number` driving routes between the same endpoints (OSRM alternatives).
   * @param {Array<{ latitude: number, longitude: number }>} waypoints
   */
  async routeAlternatives(waypoints, number = 3) {
    if (!waypoints?.length || waypoints.length < 2) {
      throw new AppError("At least two waypoints are required for OSM routing", 422);
    }
    const coordStr = waypoints
      .map((w) => `${Number(w.longitude)},${Number(w.latitude)}`)
      .join(";");
    const url =
      `${this.baseUrl}/route/v1/driving/${coordStr}` +
      "?overview=full&geometries=polyline&steps=false&alternatives=true";

    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      throw new AppError(`OSM routing failed (${res.status})`, 502);
    }
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.length) {
      throw new AppError(data.message || "OSM could not find a route", 404);
    }
    return data.routes.map((route, index) => ({
      source: "openstreetmap-osrm",
      polyline: route.geometry,
      coordinates: decodePolyline(route.geometry),
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      alternativeIndex: index,
    }));
  }

  /**
   * @param {Array<{ latitude: number, longitude: number }>} waypoints
   */
  async routeThroughWaypoints(waypoints) {
    if (!waypoints?.length || waypoints.length < 2) {
      throw new AppError("At least two waypoints are required for OSM routing", 422);
    }
    const coordStr = waypoints
      .map((w) => `${Number(w.longitude)},${Number(w.latitude)}`)
      .join(";");
    const url =
      `${this.baseUrl}/route/v1/driving/${coordStr}` +
      "?overview=full&geometries=polyline&steps=false";

    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      throw new AppError(`OSM routing failed (${res.status})`, 502);
    }
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.[0]) {
      throw new AppError(data.message || "OSM could not find a route", 404);
    }
    const route = data.routes[0];
    const coords = decodePolyline(route.geometry);
    return {
      source: "openstreetmap-osrm",
      polyline: route.geometry,
      coordinates: coords,
      distanceMeters: route.distance,
      durationSeconds: route.duration,
    };
  }

  /** @param {Array<{ latitude: number, longitude: number, name?: string }>} stops */
  async routeThroughStops(stops) {
    const ordered = [...stops].sort(
      (a, b) => (a.sequenceOrder ?? 0) - (b.sequenceOrder ?? 0),
    );
    const waypoints = ordered.map((s) => ({
      latitude: s.latitude,
      longitude: s.longitude,
    }));
    return this.routeThroughWaypoints(waypoints);
  }

  /**
   * Fallback straight-line polyline when OSRM is unreachable.
   */
  fallbackPolyline(waypoints) {
    const coords = waypoints.map((w) => ({
      latitude: Number(w.latitude),
      longitude: Number(w.longitude),
    }));
    return {
      source: "fallback-direct",
      polyline: encodePolyline(coords),
      coordinates: coords,
      distanceMeters: pathTotalMeters(coords),
      durationSeconds: null,
    };
  }
}

export const osmRoutingService = new OsmRoutingService();
