import { z } from "zod";
import { osmRoutingService } from "../services/OsmRoutingService.js";

const osmWaypointsSchema = z.object({
  waypoints: z
    .array(
      z.object({
        latitude: z.number().gte(-90).lte(90),
        longitude: z.number().gte(-180).lte(180),
      }),
    )
    .min(2),
});

export class TrackingController {
  constructor(routeOptimizationService, stopEtaService, getNearbyBuses, routePassengerInfoService) {
    this.routeOptimizationService = routeOptimizationService;
    this.stopEtaService = stopEtaService;
    this.getNearbyBuses = getNearbyBuses;
    this.routePassengerInfoService = routePassengerInfoService;
  }

  nearbyBuses = async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radius = Number(req.query.radius ?? 8000);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      res.status(422).json({ message: "lat and lng are required" });
      return;
    }
    const buses = this.getNearbyBuses(lat, lng, radius);
    res.status(200).json({
      buses,
      radiusMeters: radius,
      userLocation: { latitude: lat, longitude: lng },
      country: "ET",
    });
  };

  osmRoute = async (req, res) => {
    const body = osmWaypointsSchema.parse(req.body);
    try {
      const result = await osmRoutingService.routeThroughWaypoints(body.waypoints);
      res.status(200).json(result);
    } catch {
      const fallback = osmRoutingService.fallbackPolyline(body.waypoints);
      res.status(200).json({ ...fallback, warning: "OSM unavailable; using direct path" });
    }
  };

  optimizeRoute = async (req, res) => {
    const routeId = String(req.params.routeId);
    const result = await this.routeOptimizationService.optimize(routeId, {
      fromStopId: req.query.fromStopId ? String(req.query.fromStopId) : undefined,
      toStopId: req.query.toStopId ? String(req.query.toStopId) : undefined,
      fromLat: req.query.fromLat != null ? Number(req.query.fromLat) : undefined,
      fromLng: req.query.fromLng != null ? Number(req.query.fromLng) : undefined,
      toLat: req.query.toLat != null ? Number(req.query.toLat) : undefined,
      toLng: req.query.toLng != null ? Number(req.query.toLng) : undefined,
    });
    if (!result) {
      res.status(404).json({ message: "Route not found or path could not be optimized" });
      return;
    }
    res.status(200).json(result);
  };

  stopEtas = async (req, res) => {
    const routeId = String(req.params.routeId);
    const result = await this.stopEtaService.compute(routeId);
    if (!result) {
      res.status(404).json({ message: "Route not found" });
      return;
    }
    res.status(200).json(result);
  };

  passengerInfo = async (req, res) => {
    const routeId = String(req.params.routeId);
    const result = await this.routePassengerInfoService.execute(routeId);
    if (!result) {
      res.status(404).json({ message: "Route not found" });
      return;
    }
    res.status(200).json(result);
  };
}
