import { Router } from "express";
import { testDbConnection } from "../config/database.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  const dbOk = await testDbConnection();
  res.json({
    ok: true,
    service: "gizego-api",
    database: dbOk ? "connected" : envDatabaseHint(),
  });
});

function envDatabaseHint() {
  return process.env.DATABASE_URL ? "unreachable" : "not configured (set DATABASE_URL)";
}
