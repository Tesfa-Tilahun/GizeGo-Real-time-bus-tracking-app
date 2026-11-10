import { Pool } from "pg";
import { env } from "./env.js";

export const pool =
  env.databaseUrl.length > 0
    ? new Pool({ connectionString: env.databaseUrl })
    : null;

export async function testDbConnection() {
  if (!pool) return false;
  try {
    const client = await pool.connect();
    client.release();
    return true;
  } catch {
    return false;
  }
}

export async function query(text, params = []) {
  if (!pool) {
    throw new Error("DATABASE_NOT_CONFIGURED");
  }

  const result = await pool.query(text, params);
  return result.rows;
}
