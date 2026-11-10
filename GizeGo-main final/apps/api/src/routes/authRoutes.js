import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { asyncHandler } from "../shared/utils/asyncHandler.js";

export function createAuthRouter({ authController, tokenService }) {
  const router = Router();
  const protect = authenticate(tokenService);

  router.post("/register", asyncHandler(authController.register));
  router.post("/login", asyncHandler(authController.login));
  router.post("/forgot-password", asyncHandler(authController.forgotPassword));
  router.post("/reset-password", asyncHandler(authController.resetPassword));
  router.post("/google", asyncHandler(authController.googleAuth));
  router.post("/logout", asyncHandler(authController.logout));
  router.get("/me", protect, asyncHandler(authController.me));
  router.patch("/me", protect, asyncHandler(authController.updateProfile));
  router.post("/me/avatar", protect, asyncHandler(authController.uploadAvatar));
  router.get(
    "/admin-only",
    protect,
    authorize("admin"),
    asyncHandler(authController.adminOnly),
  );
  router.get(
    "/driver-area",
    protect,
    authorize("driver", "admin"),
    asyncHandler(authController.driverOrAdmin),
  );
  router.get(
    "/driver/assignment",
    protect,
    authorize("driver"),
    asyncHandler(authController.driverAssignment),
  );
  router.get(
    "/ticket-vendor-area",
    protect,
    authorize("ticket_vendor", "admin"),
    asyncHandler(authController.ticketVendorOrAdmin),
  );

  return router;
}
