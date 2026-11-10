import { query } from "../config/database.js";
import { AppError } from "../shared/errors/AppError.js";
import { slugifyOperatorId } from "../shared/utils/operatorSlug.js";

export class PostgresOperatorRepository {
  async listWithBusCounts() {
    const rows = await this.safeQuery(
      `SELECT o.id, o.name, o.created_at,
              COUNT(b.id)::int AS bus_count
       FROM operators o
       LEFT JOIN buses b ON b.operator = o.id
       GROUP BY o.id, o.name, o.created_at
       ORDER BY o.name`,
    );
    return rows.map((r) => this.toDomain(r));
  }

  async listIds() {
    const rows = await this.safeQuery(`SELECT id FROM operators ORDER BY name`);
    return rows.map((r) => r.id);
  }

  async findById(id) {
    const rows = await this.safeQuery(
      `SELECT o.id, o.name, o.created_at,
              COUNT(b.id)::int AS bus_count
       FROM operators o
       LEFT JOIN buses b ON b.operator = o.id
       WHERE o.id = $1
       GROUP BY o.id, o.name, o.created_at`,
      [id],
    );
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async exists(id) {
    const rows = await this.safeQuery(`SELECT 1 FROM operators WHERE id = $1 LIMIT 1`, [id]);
    return rows.length > 0;
  }

  async create({ name }) {
    const id = slugifyOperatorId(name);
    if (!id) {
      throw new AppError("Operator name must contain letters or numbers", 400);
    }

    const rows = await this.safeQuery(
      `INSERT INTO operators (id, name) VALUES ($1, $2)
       RETURNING id, name, created_at`,
      [id, name.trim()],
    );
    return { ...this.toDomain(rows[0]), busCount: 0 };
  }

  async update(id, { name }) {
    const rows = await this.safeQuery(
      `UPDATE operators SET name = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, created_at`,
      [id, name.trim()],
    );
    if (rows.length === 0) return null;
    return this.findById(id);
  }

  async deleteById(id) {
    const busRows = await this.safeQuery(
      `SELECT COUNT(*)::int AS c FROM buses WHERE operator = $1`,
      [id],
    );
    if ((busRows[0]?.c ?? 0) > 0) {
      throw new AppError("Cannot delete an operator that still has buses assigned", 400);
    }

    const rows = await this.safeQuery(`DELETE FROM operators WHERE id = $1 RETURNING id`, [id]);
    return rows.length > 0;
  }

  toDomain(row) {
    return {
      id: row.id,
      name: row.name,
      busCount: Number(row.bus_count ?? 0),
      createdAt: new Date(row.created_at),
    };
  }

  async safeQuery(sql, params = []) {
    try {
      return await query(sql, params);
    } catch (error) {
      if (error instanceof Error && error.message === "DATABASE_NOT_CONFIGURED") {
        throw new AppError("Database is not configured", 503);
      }
      if (error.code === "23505") {
        throw new AppError("An operator with this name already exists", 409);
      }
      throw error;
    }
  }
}
