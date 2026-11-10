import { Router } from "express";
import { asyncHandler } from "../shared/utils/asyncHandler.js";

export function createSearchRouter({ searchController }) {
  const r = Router();
  r.get("/locations", asyncHandler(searchController.searchLocations));
  r.get("/routes", asyncHandler(searchController.searchRoutes));
  return r;
}
