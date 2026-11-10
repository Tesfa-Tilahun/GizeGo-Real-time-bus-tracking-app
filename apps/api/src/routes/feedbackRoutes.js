import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { asyncHandler } from "../shared/utils/asyncHandler.js";

export function createFeedbackRouter({ feedbackController, tokenService }) {
  const router = Router();
  const protect = authenticate(tokenService);
  const passengerOnly = [protect, authorize("passenger")];

  router.post("/", ...passengerOnly, asyncHandler(feedbackController.submit));
  router.get("/mine", ...passengerOnly, asyncHandler(feedbackController.listMine));

  return router;
}
