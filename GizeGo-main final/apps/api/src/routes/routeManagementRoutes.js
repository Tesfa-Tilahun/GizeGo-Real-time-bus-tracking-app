import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { asyncHandler } from "../shared/utils/asyncHandler.js";

export function createRoutesManagementRouter({ routeManagementController, tokenService }) {
  const r = Router();
  const adminOnly = tokenService
    ? [authenticate(tokenService), authorize("admin")]
    : [];

  r.get("/", asyncHandler(routeManagementController.listRoutes));
  r.get("/:routeId/buses", asyncHandler(routeManagementController.listRouteBuses));
  r.get("/:routeId", asyncHandler(routeManagementController.getRoute));

  r.post("/", ...adminOnly, asyncHandler(routeManagementController.createRoute));
  r.patch("/:routeId", ...adminOnly, asyncHandler(routeManagementController.updateRoute));
  r.delete("/:routeId", ...adminOnly, asyncHandler(routeManagementController.removeRoute));
  r.post("/:routeId/buses", ...adminOnly, asyncHandler(routeManagementController.assignBus));
  r.patch(
    "/:routeId/buses/:busId",
    ...adminOnly,
    asyncHandler(routeManagementController.updateBusAssignment),
  );
  r.delete(
    "/:routeId/buses/:busId",
    ...adminOnly,
    asyncHandler(routeManagementController.unassignBus),
  );

  return r;
}

export function createBusesManagementRouter({ routeManagementController, tokenService }) {
  const r = Router();
  const adminOnly = tokenService
    ? [authenticate(tokenService), authorize("admin")]
    : [];

  r.get("/", asyncHandler(routeManagementController.listAllBuses));
  r.post("/", ...adminOnly, asyncHandler(routeManagementController.createBus));
  r.get("/:busId", asyncHandler(routeManagementController.getBusEntity));
  r.patch("/:busId", ...adminOnly, asyncHandler(routeManagementController.updateBusEntity));
  r.delete("/:busId", ...adminOnly, asyncHandler(routeManagementController.deleteBusEntity));
  return r;
}
