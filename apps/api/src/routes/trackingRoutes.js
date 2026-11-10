import { Router } from "express";
import { asyncHandler } from "../shared/utils/asyncHandler.js";

export function createTrackingRouter({ trackingController }) {
  const r = Router();
  r.get("/nearby-buses", asyncHandler(trackingController.nearbyBuses));
  r.post("/osm-route", asyncHandler(trackingController.osmRoute));
  r.get("/routes/:routeId/optimize", asyncHandler(trackingController.optimizeRoute));
  r.get("/routes/:routeId/stop-etas", asyncHandler(trackingController.stopEtas));
  r.get("/routes/:routeId/passenger-info", asyncHandler(trackingController.passengerInfo));
  return r;
}
