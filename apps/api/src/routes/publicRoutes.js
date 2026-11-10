import { Router } from "express";
import { asyncHandler } from "../shared/utils/asyncHandler.js";

export function createPublicRouter({ translateController }) {
  const r = Router();
  r.post("/translate", asyncHandler(translateController.translateBatch));
  return r;
}
