import { query } from "../config/database.js";
import { AppError } from "../shared/errors/AppError.js";

export class PostgresRevokedTokenRepository {
  async isRevoked(jti) {
    const rows = await this.safeQuery(
      `SELECT 1 AS one
       FROM revoked_tokens
       WHERE jti = $1 AND expires_at > NOW()`,
      [jti],
    );
    return rows.length > 0;
  }

  async revoke(jti, expiresAt) {
    await this.safeQuery(
      `INSERT INTO revoked_tokens (jti, expires_at)
       VALUES ($1, $2)
       ON CONFLICT (jti) DO UPDATE
       SET expires_at = GREATEST(revoked_tokens.expires_at, EXCLUDED.expires_at)`,
      [jti, expiresAt],
    );
    await this.safeQuery(`DELETE FROM revoked_tokens WHERE expires_at < NOW()`, []);
  }

  async safeQuery(sql, params) {
    try {
      return await query(sql, params);
    } catch (error) {
      if (error instanceof Error && error.message === "DATABASE_NOT_CONFIGURED") {
        throw new AppError("Database is not configured", 503);
      }
      throw error;
    }
  }
}
