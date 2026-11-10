import { query } from "../config/database.js";
import { AppError } from "../shared/errors/AppError.js";

async function safeQuery(sql, params = []) {
  try {
    return await query(sql, params);
  } catch (error) {
    if (error instanceof Error && error.message === "DATABASE_NOT_CONFIGURED") {
      throw new AppError("Database is not configured", 503);
    }
    throw error;
  }
}

export class PostgresPoiRepository {
  async listPois(filterText) {
    const params = [];
    let sql = `SELECT id, name, category, latitude, longitude FROM map_pois`;
    if (filterText?.trim()) {
      sql += ` WHERE name ILIKE $1`;
      params.push(`%${filterText.trim()}%`);
    }
    sql += ` ORDER BY name`;
    const rows = await safeQuery(sql, params);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
    }));
  }

  async searchNameSuggestions(q, limit = 15) {
    const pattern = `%${q.trim()}%`;
    const rows = await safeQuery(
      `SELECT name FROM map_pois WHERE name ILIKE $1 ORDER BY name LIMIT $2`,
      [pattern, limit],
    );
    return rows.map((r) => r.name);
  }
}
