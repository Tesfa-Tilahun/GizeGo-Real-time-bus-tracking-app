import { randomUUID } from "node:crypto";
import { encodePolyline } from "../shared/utils/polyline.js";
import {
  ROUTE_CATALOG,
  FLEET_OPERATORS,
  placeCoords,
  parseDurationMinutes,
  parseDistanceMeters,
} from "../data/routeCatalog.js";

/**
 * Seeds official route catalog when the routes table has no catalog entries yet.
 */
export class RouteCatalogSeedService {
  /** @param {import("pg").Pool} pool */
  constructor(pool) {
    this.pool = pool;
  }

  async seed() {
    if (!this.pool) return { seeded: 0 };

    const { rows } = await this.pool.query(
      `SELECT COUNT(*)::int AS c FROM routes WHERE code IS NOT NULL`,
    );
    if ((rows[0]?.c ?? 0) > 0) {
      return { seeded: 0, skipped: true };
    }

    let seeded = 0;
    for (const entry of ROUTE_CATALOG) {
      const id = `route-${entry.code.toLowerCase()}`;
      const name = `${entry.origin} -> ${entry.destination}`;
      const dep = placeCoords(entry.origin);
      const arr = placeCoords(entry.destination);
      const polyline = encodePolyline([dep, arr]);
      const distanceMeters = parseDistanceMeters(String(entry.distanceKm));
      const durationMinutes = parseDurationMinutes(entry.duration);

      await this.pool.query(
        `INSERT INTO routes (id, code, name, polyline, distance_meters, price, duration_minutes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [id, entry.code, name, polyline, distanceMeters, entry.fareEtb, durationMinutes],
      );

      const depStopId = randomUUID();
      const arrStopId = randomUUID();
      await this.pool.query(`DELETE FROM stops WHERE route_id = $1`, [id]);
      await this.pool.query(
        `INSERT INTO stops (id, route_id, sequence_order, name, latitude, longitude) VALUES
         ($1, $2, 1, $3, $4, $5),
         ($6, $2, 2, $7, $8, $9)`,
        [
          depStopId,
          id,
          entry.origin,
          dep.latitude,
          dep.longitude,
          arrStopId,
          entry.destination,
          arr.latitude,
          arr.longitude,
        ],
      );
      seeded += 1;
    }

    console.info(`Route catalog: seeded ${seeded} routes`);
    return { seeded };
  }
}

/**
 * Seeds operator fleet buses (Ambessa, Addis, Shega) and assigns them to routes.
 */
export class OperatorFleetSeedService {
  /** @param {import("pg").Pool} pool */
  constructor(pool) {
    this.pool = pool;
  }

  async seed() {
    if (!this.pool) return { buses: 0 };

    const { rows: opRows } = await this.pool.query(
      `SELECT COUNT(*)::int AS c FROM buses WHERE operator IS NOT NULL`,
    );
    if ((opRows[0]?.c ?? 0) > 0) {
      return { buses: 0, skipped: true };
    }

    const { rows: routes } = await this.pool.query(
      `SELECT id, code FROM routes WHERE code IS NOT NULL ORDER BY code`,
    );
    if (routes.length === 0) return { buses: 0 };

    let busCount = 0;
    let routeIdx = 0;

    for (const operator of FLEET_OPERATORS) {
      const label = operator.charAt(0).toUpperCase() + operator.slice(1);
      for (let n = 1; n <= 4; n += 1) {
        const busId = `bus-${operator}-${n}`;
        const busName = `${label} Bus ${String(n).padStart(2, "0")}`;
        await this.pool.query(
          `INSERT INTO buses (id, name, operator) VALUES ($1, $2, $3)
           ON CONFLICT (id) DO NOTHING`,
          [busId, busName, operator],
        );

        for (let r = 0; r < 3 && routes.length > 0; r += 1) {
          const route = routes[routeIdx % routes.length];
          routeIdx += 1;
          const stops = await this.pool.query(
            `SELECT id, sequence_order FROM stops WHERE route_id = $1 ORDER BY sequence_order`,
            [route.id],
          );
          if (stops.rows.length < 2) continue;
          const first = stops.rows[0];
          const last = stops.rows[stops.rows.length - 1];
          await this.pool.query(
            `INSERT INTO bus_routes (bus_id, route_id, departure_stop_id, arrival_stop_id, departure_time, arrival_time)
             VALUES ($1, $2, $3, $4, $5::time, $6::time)
             ON CONFLICT DO NOTHING`,
            [busId, route.id, first.id, last.id, "06:00", "22:00"],
          );
        }
        busCount += 1;
      }
    }

    console.info(`Operator fleet: seeded ${busCount} buses (${FLEET_OPERATORS.join(", ")})`);
    return { buses: busCount };
  }
}
