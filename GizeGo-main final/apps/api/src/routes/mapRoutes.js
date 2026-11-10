import { Router } from "express";
import { asyncHandler } from "../shared/utils/asyncHandler.js";

export function createMapRouter({ mapController }) {
  const r = Router();
  r.get("/pois", asyncHandler(mapController.listPois));
  r.get("/recommended-route", asyncHandler(mapController.recommendedRoute));
  r.get("/places", asyncHandler(mapController.searchPlaces));
  r.get("/geocode", asyncHandler(mapController.geocodeEthiopia));
  r.get("/reverse-geocode", asyncHandler(mapController.reverseGeocode));
  r.get("/routes/:routeId/stops", asyncHandler(mapController.routeStops));
  return r;
}
