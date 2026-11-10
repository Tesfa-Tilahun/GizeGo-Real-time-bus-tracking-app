import { createHash, randomBytes } from "node:crypto";
import { query } from "../config/database.js";
import { AppError } from "../shared/errors/AppError.js";

export class PostgresPasswordResetRepository {
  /**
   * @param {string} userId
   * @param {number} [ttlMs] default 1 hour
   * @returns {{ plainToken: string, expiresAt: Date }}
   */
  async createForUser(userId, ttlMs = 60 * 60 * 1000) {
    const raw = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(raw).digest("hex");
    const expiresAt = new Date(Date.now() + ttlMs);
    try {
      await query(`DELETE FROM password_reset_tokens WHERE user_id = $1`, [userId]);
      await query(
        `INSERT INTO password_reset_tokens (token_hash, user_id, expires_at)
         VALUES ($1, $2, $3)`,
        [tokenHash, userId, expiresAt],
      );
    } catch (error) {
      if (error instanceof Error && error.message === "DATABASE_NOT_CONFIGURED") {
        throw new AppError("Database is not configured", 503);
      }
      throw error;
    }
    return { plainToken: raw, expiresAt };
  }

  /** @returns {string|null} userId */
  async consume(plainToken) {
    const tokenHash = createHash("sha256").update(plainToken.trim()).digest("hex");
    try {
      const rows = await query(
        `DELETE FROM password_reset_tokens
         WHERE token_hash = $1 AND expires_at > NOW()
         RETURNING user_id`,
        [tokenHash],
      );
      return rows[0]?.user_id ?? null;
    } catch (error) {
      if (error instanceof Error && error.message === "DATABASE_NOT_CONFIGURED") {
        throw new AppError("Database is not configured", 503);
      }
      throw error;
    }
  }
}
