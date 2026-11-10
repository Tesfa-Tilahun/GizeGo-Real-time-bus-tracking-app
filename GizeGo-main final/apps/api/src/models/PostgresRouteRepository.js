import { pool, query } from "../config/database.js";
import { AppError } from "../shared/errors/AppError.js";
import { randomUUID } from "node:crypto";
import { searchTextMatches } from "../shared/utils/searchText.js";

function toNum(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function toNumReq(v) {
  if (typeof v === "number") return v;
  return parseFloat(v);
}

/** @param {string | null | undefined} pgTime postgres time text e.g. "08:05:00" */
function formatPgTimeHHmm(pgTime) {
  if (pgTime == null || pgTime === "") return undefined;
  const s = typeof pgTime === "string" ? pgTime : String(pgTime);
  return s.length >= 5 ? s.slice(0, 5) : s;
}

export class PostgresRouteRepository {
  async listSummaries() {
    const rows = await this.safeQuery(
      `SELECT r.id, r.code, r.name, r.distance_meters, r.price, r.duration_minutes,
              r.created_at, r.updated_at,
        (SELECT COUNT(*)::int FROM stops s WHERE s.route_id = r.id) AS stop_count,
        (SELECT COUNT(*)::int FROM bus_routes br WHERE br.route_id = r.id) AS bus_count
       FROM routes r
       ORDER BY r.code NULLS LAST, r.name`,
    );
    return rows.map((r) => this.rowToSummary(r));
  }

  async listCanonicalStopLocations() {
    const rows = await this.safeQuery(
      `SELECT
         lower(regexp_replace(name, '[[:space:]]+', ' ', 'g')) AS key,
         MIN(name) AS name,
         AVG(latitude)::float AS latitude,
         AVG(longitude)::float AS longitude,
         COUNT(*)::int AS stop_count
       FROM stops
       GROUP BY lower(regexp_replace(name, '[[:space:]]+', ' ', 'g'))
       ORDER BY MIN(name)`,
    );
    return rows.map((r) => ({
      id: `stop-${String(r.key).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
      canonicalName: r.name,
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      aliases: [r.name],
      source: "stops",
      stopCount: Number(r.stop_count ?? 0),
    }));
  }

  async searchSummariesByStops(fromQuery, toQuery, opts = {}) {
    const fromText = String(fromQuery ?? "").trim();
    const toText = String(toQuery ?? "").trim();
    const fromLat = opts.fromLat;
    const fromLng = opts.fromLng;
    const radiusMeters = Number(opts.radiusMeters) > 0 ? Number(opts.radiusMeters) : 2500;

    const params = [];
    let fromClause;

    if (fromText.length > 0) {
      fromClause = `TRUE`;
    } else if (Number.isFinite(fromLat) && Number.isFinite(fromLng)) {
      params.push(fromLat, fromLng, radiusMeters);
      fromClause = `EXISTS (
         SELECT 1 FROM stops s1
         WHERE s1.route_id = r.id
         AND (
           6371000 * acos(LEAST(1, GREATEST(-1,
             cos(radians($1)) * cos(radians(s1.latitude)) * cos(radians(s1.longitude) - radians($2))
             + sin(radians($1)) * sin(radians(s1.latitude))
           )))
         ) <= $3
       )`;
    } else {
      return [];
    }

    const rows = await this.safeQuery(
      `SELECT r.id, r.code, r.name, r.distance_meters, r.price, r.duration_minutes,
              r.created_at, r.updated_at,
        (SELECT COUNT(*)::int FROM stops s WHERE s.route_id = r.id) AS stop_count,
        (SELECT COUNT(*)::int FROM bus_routes br WHERE br.route_id = r.id) AS bus_count,
        COALESCE(array_agg(s.name ORDER BY s.sequence_order) FILTER (WHERE s.id IS NOT NULL), '{}') AS stop_names
       FROM routes r
       LEFT JOIN stops s ON s.route_id = r.id
       WHERE ${fromClause}
       GROUP BY r.id
       ORDER BY r.name`,
      params,
    );
    return rows
      .filter((r) => {
        const stops = r.stop_names ?? [];
        const fromMatches =
          !fromText ||
          stops.some((name) => searchTextMatches(name, fromText)) ||
          searchTextMatches(r.name, fromText);
        const toMatches =
          stops.some((name) => searchTextMatches(name, toText)) ||
          searchTextMatches(r.name, toText);
        return fromMatches && toMatches;
      })
      .map((r) => this.rowToSummary(r));
  }

  async findNearestStop(latitude, longitude, maxMeters = 2500) {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    const rows = await this.safeQuery(
      `SELECT id, route_id, name, latitude, longitude, distance_m
       FROM (
         SELECT id, route_id, name, latitude, longitude,
           6371000 * acos(LEAST(1, GREATEST(-1,
             cos(radians($1)) * cos(radians(latitude)) * cos(radians(longitude) - radians($2))
             + sin(radians($1)) * sin(radians(latitude))
           ))) AS distance_m
         FROM stops
         WHERE latitude IS NOT NULL AND longitude IS NOT NULL
       ) nearby
       WHERE distance_m <= $3
       ORDER BY distance_m
       LIMIT 1`,
      [latitude, longitude, maxMeters],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      routeId: row.route_id,
      name: row.name,
      latitude: toNum(row.latitude),
      longitude: toNum(row.longitude),
      distanceMeters: toNum(row.distance_m),
    };
  }

  async searchSummariesByCanonicalLocations(fromLocation, toLocation, opts = {}) {
    if (!fromLocation || !toLocation) return [];
    const radiusMeters = Number(opts.radiusMeters) > 0 ? Number(opts.radiusMeters) : 1500;
    const fromProbeLat = Number.isFinite(opts.fromGpsLat) ? opts.fromGpsLat : fromLocation.latitude;
    const fromProbeLng = Number.isFinite(opts.fromGpsLng) ? opts.fromGpsLng : fromLocation.longitude;
    const toProbeLat = Number.isFinite(opts.toGpsLat) ? opts.toGpsLat : toLocation.latitude;
    const toProbeLng = Number.isFinite(opts.toGpsLng) ? opts.toGpsLng : toLocation.longitude;
    const params = [
      fromProbeLat,
      fromProbeLng,
      toProbeLat,
      toProbeLng,
      radiusMeters,
    ];
    const rows = await this.safeQuery(
      `SELECT r.id, r.code, r.name, r.distance_meters, r.price, r.duration_minutes,
              r.created_at, r.updated_at,
        (SELECT COUNT(*)::int FROM stops s WHERE s.route_id = r.id) AS stop_count,
        (SELECT COUNT(*)::int FROM bus_routes br WHERE br.route_id = r.id) AS bus_count,
        COALESCE(array_agg(s.name ORDER BY s.sequence_order) FILTER (WHERE s.id IS NOT NULL), '{}') AS stop_names
       FROM routes r
       LEFT JOIN stops s ON s.route_id = r.id
       WHERE EXISTS (
         SELECT 1 FROM stops sf
         INNER JOIN stops st ON st.route_id = sf.route_id AND sf.sequence_order < st.sequence_order
         WHERE sf.route_id = r.id
         AND (
           sf.name ILIKE $6
           OR 6371000 * acos(LEAST(1, GREATEST(-1,
             cos(radians($1)) * cos(radians(sf.latitude)) * cos(radians(sf.longitude) - radians($2))
             + sin(radians($1)) * sin(radians(sf.latitude))
           ))) <= $5
         )
         AND (
           st.name ILIKE $7
           OR 6371000 * acos(LEAST(1, GREATEST(-1,
             cos(radians($3)) * cos(radians(st.latitude)) * cos(radians(st.longitude) - radians($4))
             + sin(radians($3)) * sin(radians(st.latitude))
           ))) <= $5
         )
       )
       GROUP BY r.id
       ORDER BY r.name`,
      [
        ...params,
        `%${fromLocation.canonicalName}%`,
        `%${toLocation.canonicalName}%`,
      ],
    );
    return rows.map((r) => this.rowToSummary(r));
  }

  rowToSummary(r) {
    return {
      id: r.id,
      code: r.code ?? undefined,
      name: r.name,
      distanceMeters: toNum(r.distance_meters),
      durationMinutes: r.duration_minutes != null ? Number(r.duration_minutes) : undefined,
      price: toNumReq(r.price),
      stopCount: Number(r.stop_count),
      busCount: Number(r.bus_count ?? 0),
      createdAt: new Date(r.created_at),
      updatedAt: new Date(r.updated_at),
    };
  }

  async searchStopNameSuggestions(q, limit = 15) {
    const rows = await this.safeQuery(
      `SELECT DISTINCT name FROM stops ORDER BY name`,
    );
    return rows
      .map((r) => r.name)
      .filter((name) => searchTextMatches(name, q))
      .slice(0, limit);
  }

  async findById(id) {
    const rRows = await this.safeQuery(
      `SELECT id, code, name, polyline, distance_meters, price, duration_minutes, created_at, updated_at
       FROM routes WHERE id = $1 LIMIT 1`,
      [id],
    );
    const base = rRows[0];
    if (!base) return null;

    const sRows = await this.safeQuery(
      `SELECT id, route_id, sequence_order, name, latitude, longitude
       FROM stops
       WHERE route_id = $1
       ORDER BY sequence_order`,
      [id],
    );

    return {
      ...this.toRoute(base),
      stops: sRows.map((s) => this.toStop(s)),
    };
  }

  async create(input) {
    if (!pool) {
      throw new AppError("Database is not configured", 503);
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO routes (id, code, name, polyline, distance_meters, price, duration_minutes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          input.id,
          input.code ?? null,
          input.name,
          input.polyline,
          input.distanceMeters,
          input.price,
          input.durationMinutes ?? null,
        ],
      );
      for (const s of input.stops) {
        const stopId = randomUUID();
        await client.query(
          `INSERT INTO stops (id, route_id, sequence_order, name, latitude, longitude)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [stopId, input.id, s.sequenceOrder, s.name, s.latitude, s.longitude],
        );
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }

    const full = await this.findById(input.id);
    if (!full) {
      throw new AppError("Failed to create route", 500);
    }
    return full;
  }

  async update(id, patch) {
    if (!pool) {
      throw new AppError("Database is not configured", 503);
    }
    const existing = await this.findById(id);
    if (!existing) {
      throw new AppError("Route not found", 404);
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      if (patch.stops !== undefined) {
        await client.query(`DELETE FROM stops WHERE route_id = $1`, [id]);
        for (const s of patch.stops) {
          await client.query(
            `INSERT INTO stops (id, route_id, sequence_order, name, latitude, longitude)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [randomUUID(), id, s.sequenceOrder, s.name, s.latitude, s.longitude],
          );
        }
      }

      const assignments = [];
      const values = [];
      let i = 1;
      if (patch.code !== undefined) {
        assignments.push(`code = $${i++}`);
        values.push(patch.code);
      }
      if (patch.durationMinutes !== undefined) {
        assignments.push(`duration_minutes = $${i++}`);
        values.push(patch.durationMinutes);
      }
      if (patch.name !== undefined) {
        assignments.push(`name = $${i++}`);
        values.push(patch.name);
      }
      if (patch.polyline !== undefined) {
        assignments.push(`polyline = $${i++}`);
        values.push(patch.polyline);
      }
      if (patch.distanceMeters !== undefined) {
        assignments.push(`distance_meters = $${i++}`);
        values.push(patch.distanceMeters);
      }
      if (patch.price !== undefined) {
        assignments.push(`price = $${i++}`);
        values.push(patch.price);
      }
      if (assignments.length > 0) {
        assignments.push(`updated_at = NOW()`);
        values.push(id);
        await client.query(
          `UPDATE routes SET ${assignments.join(", ")} WHERE id = $${i}`,
          values,
        );
      } else if (patch.stops !== undefined) {
        await client.query(`UPDATE routes SET updated_at = NOW() WHERE id = $1`, [id]);
      }

      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }

    const full = await this.findById(id);
    if (!full) {
      throw new AppError("Route not found", 404);
    }
    return full;
  }

  async delete(id) {
    const rows = await this.safeQuery(`DELETE FROM routes WHERE id = $1 RETURNING id`, [id]);
    if (rows.length === 0) {
      throw new AppError("Route not found", 404);
    }
  }

  async listBusesOnRoute(routeId) {
    const rows = await this.safeQuery(
      `SELECT b.id, b.name, b.created_at,
        br.departure_stop_id AS dep_stop_id,
        br.arrival_stop_id AS arr_stop_id,
        br.departure_time::text AS dep_time,
        br.arrival_time::text AS arr_time,
        sd.name AS dep_stop_name,
        sa.name AS arr_stop_name
       FROM bus_routes br
       INNER JOIN buses b ON b.id = br.bus_id
       LEFT JOIN stops sd ON sd.id = br.departure_stop_id
       LEFT JOIN stops sa ON sa.id = br.arrival_stop_id
       WHERE br.route_id = $1
       ORDER BY br.departure_time NULLS LAST, b.name`,
      [routeId],
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      createdAt: new Date(r.created_at),
      departureStopId: r.dep_stop_id ?? undefined,
      arrivalStopId: r.arr_stop_id ?? undefined,
      departureStopName: r.dep_stop_name ?? undefined,
      arrivalStopName: r.arr_stop_name ?? undefined,
      departureTime: formatPgTimeHHmm(r.dep_time),
      arrivalTime: formatPgTimeHHmm(r.arr_time),
    }));
  }

  async validateStopsOnRoute(routeId, stopIds) {
    const uniq = [...new Set(stopIds.filter(Boolean))];
    if (uniq.length === 0) {
      throw new AppError("Stop ids are required", 422);
    }
    const rows = await this.safeQuery(
      `SELECT id FROM stops WHERE route_id = $1 AND id = ANY($2::text[])`,
      [routeId, uniq],
    );
    if (rows.length !== uniq.length) {
      throw new AppError("Departure and arrival stops must belong to this route", 422);
    }
  }

  async getRouteTerminalStops(routeId) {
    const rows = await this.safeQuery(
      `SELECT id FROM stops WHERE route_id = $1 ORDER BY sequence_order ASC`,
      [routeId],
    );
    if (rows.length < 2) {
      throw new AppError("Route must have at least two stops before assigning a bus", 422);
    }
    return {
      departureStopId: rows[0].id,
      arrivalStopId: rows[rows.length - 1].id,
    };
  }

  async normalizeAssignment(routeId, assignment = {}) {
    const terminals = await this.getRouteTerminalStops(routeId);
    const departureStopId = assignment.departureStopId ?? terminals.departureStopId;
    const arrivalStopId = assignment.arrivalStopId ?? terminals.arrivalStopId;
    await this.validateStopsOnRoute(routeId, [departureStopId, arrivalStopId]);
    if (departureStopId === arrivalStopId) {
      throw new AppError("Departure and arrival stops must be different", 422);
    }
    return {
      departureStopId,
      arrivalStopId,
      departureTime: assignment.departureTime ?? null,
      arrivalTime: assignment.arrivalTime ?? null,
    };
  }

  async assignBusToRoute(routeId, busId, assignment = {}) {
    const r = await this.safeQuery(`SELECT 1 FROM routes WHERE id = $1`, [routeId]);
    if (r.length === 0) {
      throw new AppError("Route not found", 404);
    }
    const b = await this.safeQuery(`SELECT 1 FROM buses WHERE id = $1`, [busId]);
    if (b.length === 0) {
      throw new AppError("Bus not found", 404);
    }

    const resolved = await this.normalizeAssignment(routeId, assignment);

    try {
      await query(
        `INSERT INTO bus_routes (bus_id, route_id, departure_stop_id, arrival_stop_id, departure_time, arrival_time)
         VALUES ($1, $2, $3, $4, $5::time, $6::time)`,
        [
          busId,
          routeId,
          resolved.departureStopId,
          resolved.arrivalStopId,
          resolved.departureTime,
          resolved.arrivalTime,
        ],
      );
    } catch (e) {
      if (e && typeof e === "object" && "code" in e && e.code === "23505") {
        throw new AppError("Bus is already assigned to this route", 409);
      }
      throw e;
    }
  }

  async updateBusAssignment(routeId, busId, assignment = {}) {
    const r = await this.safeQuery(`SELECT 1 FROM routes WHERE id = $1`, [routeId]);
    if (r.length === 0) {
      throw new AppError("Route not found", 404);
    }

    const resolved = await this.normalizeAssignment(routeId, assignment);

    const result = await this.safeQuery(
      `UPDATE bus_routes SET
        departure_stop_id = $1,
        arrival_stop_id = $2,
        departure_time = $3::time,
        arrival_time = $4::time
       WHERE route_id = $5 AND bus_id = $6
       RETURNING bus_id`,
      [
        resolved.departureStopId,
        resolved.arrivalStopId,
        resolved.departureTime,
        resolved.arrivalTime,
        routeId,
        busId,
      ],
    );
    if (result.length === 0) {
      throw new AppError("Bus is not assigned to this route", 404);
    }
  }

  async unassignBusFromRoute(routeId, busId) {
    const result = await this.safeQuery(
      `DELETE FROM bus_routes WHERE route_id = $1 AND bus_id = $2 RETURNING bus_id`,
      [routeId, busId],
    );
    if (result.length === 0) {
      throw new AppError("Assignment not found", 404);
    }
  }

  toRoute(row) {
    return {
      id: row.id,
      code: row.code ?? undefined,
      name: row.name,
      polyline: row.polyline,
      distanceMeters: toNum(row.distance_meters),
      durationMinutes:
        row.duration_minutes != null ? Number(row.duration_minutes) : undefined,
      price: toNumReq(row.price),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  toStop(row) {
    return {
      id: row.id,
      routeId: row.route_id,
      sequenceOrder: row.sequence_order,
      name: row.name,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
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
