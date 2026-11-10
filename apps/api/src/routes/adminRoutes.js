import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { asyncHandler } from "../shared/utils/asyncHandler.js";

export function createAdminRouter({ adminController, tokenService }) {
  const router = Router();
  const protect = authenticate(tokenService);
  const adminOnly = [protect, authorize("admin")];

  router.get("/drivers", ...adminOnly, asyncHandler(adminController.listDrivers));
  router.post("/drivers", ...adminOnly, asyncHandler(adminController.createDriver));
  router.get("/fleet", ...adminOnly, asyncHandler(adminController.listFleet));
  router.get("/operators", ...adminOnly, asyncHandler(adminController.listOperators));
  router.post("/operators", ...adminOnly, asyncHandler(adminController.createOperator));
  router.patch(
    "/operators/:operatorId",
    ...adminOnly,
    asyncHandler(adminController.updateOperator),
  );
  router.delete(
    "/operators/:operatorId",
    ...adminOnly,
    asyncHandler(adminController.deleteOperator),
  );
  router.get("/dashboard", ...adminOnly, asyncHandler(adminController.dashboard));
  router.get("/feedback", ...adminOnly, asyncHandler(adminController.listFeedback));
  router.patch(
    "/feedback/:feedbackId",
    ...adminOnly,
    asyncHandler(adminController.reviewFeedback),
  );
  router.get("/reports/operations", ...adminOnly, asyncHandler(adminController.analyticsReport));
  router.patch(
    "/buses/:busId/driver",
    ...adminOnly,
    asyncHandler(adminController.assignDriver),
  );
  router.patch(
    "/buses/:busId/operator",
    ...adminOnly,
    asyncHandler(adminController.assignOperator),
  );

  return router;
}
