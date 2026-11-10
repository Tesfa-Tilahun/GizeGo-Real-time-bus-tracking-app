import { query } from "../config/database.js";
import { AppError } from "../shared/errors/AppError.js";

function formatPgTimeHHmm(pgTime) {
  if (pgTime == null || pgTime === "") return undefined;
  const s = typeof pgTime === "string" ? pgTime : String(pgTime);
  return s.length >= 5 ? s.slice(0, 5) : s;
}

const busSelect = `SELECT b.id, b.name, b.operator, b.status, b.driver_id, b.created_at,
       u.name AS driver_name, u.email AS driver_email, u.phone AS driver_phone`;

export class PostgresBusRepository {
  async create(input) {
    const rows = await this.safeQuery(
      `INSERT INTO buses (id, name, operator, status) VALUES ($1, $2, $3, $4)
       RETURNING id, name, operator, status, driver_id, created_at`,
      [input.id, input.name, input.operator ?? null, input.status ?? "active"],
    );
    return this.toDomain(rows[0]);
  }

  async findByDriverId(driverId) {
    const rows = await this.safeQuery(
      `${busSelect}
       FROM buses b
       LEFT JOIN users u ON u.id = b.driver_id
       WHERE b.driver_id = $1
       LIMIT 1`,
      [driverId],
    );
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async findById(id) {
    const rows = await this.safeQuery(
      `${busSelect}
       FROM buses b
       LEFT JOIN users u ON u.id = b.driver_id
       WHERE b.id = $1 LIMIT 1`,
      [id],
    );
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async countByOperator(operator) {
    const rows = await this.safeQuery(
      `SELECT COUNT(*)::int AS c FROM buses WHERE operator = $1`,
      [operator],
    );
    return rows[0]?.c ?? 0;
  }

  async findWithAssignments(busId) {
    const bus = await this.findById(busId);
    if (!bus) return null;

    const rows = await this.safeQuery(
      `SELECT br.route_id,
              r.name AS route_name,
              r.code AS route_code,
              br.departure_stop_id,
              br.arrival_stop_id,
              br.departure_time::text AS dep_time,
              br.arrival_time::text AS arr_time,
              sd.name AS dep_stop_name,
              sa.name AS arr_stop_name,
              br.assigned_at
       FROM bus_routes br
       INNER JOIN routes r ON r.id = br.route_id
       LEFT JOIN stops sd ON sd.id = br.departure_stop_id
       LEFT JOIN stops sa ON sa.id = br.arrival_stop_id
       WHERE br.bus_id = $1
       ORDER BY br.departure_time NULLS LAST, r.name`,
      [busId],
    );

    const assignments = rows.map((r) => ({
      routeId: r.route_id,
      routeCode: r.route_code ?? undefined,
      routeName: r.route_name,
      departureStopId: r.departure_stop_id ?? undefined,
      arrivalStopId: r.arrival_stop_id ?? undefined,
      departureStopName: r.dep_stop_name ?? undefined,
      arrivalStopName: r.arr_stop_name ?? undefined,
      departureTime: formatPgTimeHHmm(r.dep_time),
      arrivalTime: formatPgTimeHHmm(r.arr_time),
      assignedAt: new Date(r.assigned_at),
    }));

    return { bus, assignments };
  }

  async listAll() {
    const rows = await this.safeQuery(
      `${busSelect},
              COUNT(br.route_id)::int AS assignments_count
       FROM buses b
       LEFT JOIN users u ON u.id = b.driver_id
       LEFT JOIN bus_routes br ON br.bus_id = b.id
       GROUP BY b.id, b.name, b.operator, b.status, b.driver_id, b.created_at, u.name, u.email, u.phone
       ORDER BY b.operator NULLS LAST, b.name`,
    );
    return rows.map((r) => this.toDomainWithAssignmentsCount(r));
  }

  async update(busId, patch) {
    const assignments = [];
    const values = [];
    let i = 1;

    if (patch.name !== undefined) {
      assignments.push(`name = $${i++}`);
      values.push(patch.name);
    }
    if (patch.operator !== undefined) {
      assignments.push(`operator = $${i++}`);
      values.push(patch.operator);
    }
    if (patch.driverId !== undefined) {
      assignments.push(`driver_id = $${i++}`);
      values.push(patch.driverId);
    }
    if (patch.status !== undefined) {
      assignments.push(`status = $${i++}`);
      values.push(patch.status);
    }

    if (assignments.length === 0) {
      return this.findById(busId);
    }

    values.push(busId);
    const rows = await this.safeQuery(
      `UPDATE buses SET ${assignments.join(", ")} WHERE id = $${i}
       RETURNING id, name, operator, status, driver_id, created_at`,
      values,
    );
    if (rows.length === 0) {
      return null;
    }

    return this.findById(busId);
  }

  async deleteById(busId) {
    const rows = await this.safeQuery(`DELETE FROM buses WHERE id = $1 RETURNING id`, [busId]);
    return rows.length > 0;
  }

  toDomain(row) {
    const bus = {
      id: row.id,
      name: row.name,
      operator: row.operator ?? undefined,
      status: row.status ?? "active",
      createdAt: new Date(row.created_at),
    };
    if (row.driver_id) {
      bus.driverId = row.driver_id;
      bus.driver = {
        id: row.driver_id,
        name: row.driver_name,
        email: row.driver_email ?? undefined,
        phone: row.driver_phone ?? undefined,
      };
    }
    return bus;
  }

  toDomainWithAssignmentsCount(row) {
    return {
      ...this.toDomain(row),
      routeAssignmentsCount: Number(row.assignments_count ?? 0),
    };
  }

  async safeQuery(sql, params = []) {
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
