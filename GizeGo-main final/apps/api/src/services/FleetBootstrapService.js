import { randomUUID } from "node:crypto";

const TARGET_MIN = 10;
const TARGET_MAX = 18;

/**
 * Ensures 10–20 simulated virtual buses exist across routes (FR3).
 */
export class FleetBootstrapService {
  /**
   * @param {import("pg").Pool} pool
   */
  constructor(pool) {
    this.pool = pool;
  }

  async ensureFleet() {
    if (!this.pool) return { created: 0, total: 0 };

    const { rows: catalogRows } = await this.pool.query(
      `SELECT COUNT(*)::int AS c FROM routes WHERE code IS NOT NULL`,
    );
    if ((catalogRows[0]?.c ?? 0) > 0) {
      return { created: 0, total: 0, skipped: true };
    }

    const { rows: countRows } = await this.pool.query(
      `SELECT COUNT(*)::int AS c FROM buses`,
    );
    let total = countRows[0]?.c ?? 0;
    if (total >= TARGET_MIN) return { created: 0, total };

    const { rows: routes } = await this.pool.query(
      `SELECT r.id, r.name,
        (SELECT COUNT(*)::int FROM bus_routes br WHERE br.route_id = r.id) AS bus_count
       FROM routes r
       ORDER BY r.name`,
    );
    if (routes.length === 0) return { created: 0, total };

    let created = 0;
    let busIndex = total + 1;
    const target = TARGET_MIN + Math.floor(Math.random() * (TARGET_MAX - TARGET_MIN + 1));

    while (total < target) {
      for (const route of routes) {
        if (total >= target) break;
        const stops = await this.pool.query(
          `SELECT id, sequence_order FROM stops WHERE route_id = $1 ORDER BY sequence_order`,
          [route.id],
        );
        if (stops.rows.length < 2) continue;

        const first = stops.rows[0];
        const last = stops.rows[stops.rows.length - 1];
        const busId = randomUUID();
        const busName = `Sim Minibus ${String(busIndex).padStart(2, "0")}`;
        busIndex += 1;

        await this.pool.query(`INSERT INTO buses (id, name) VALUES ($1, $2)`, [busId, busName]);
        await this.pool.query(
          `INSERT INTO bus_routes (bus_id, route_id, departure_stop_id, arrival_stop_id, departure_time, arrival_time)
           VALUES ($1, $2, $3, $4, $5::time, $6::time)
           ON CONFLICT DO NOTHING`,
          [busId, route.id, first.id, last.id, "06:00", "22:00"],
        );
        created += 1;
        total += 1;
      }
      if (created === 0) break;
    }

    console.info(`Fleet simulation: ${total} buses (${created} virtual buses added)`);
    return { created, total };
  }
}
