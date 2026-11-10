import { pool } from "../config/database.js";

export async function ensureSchema() {
  if (!pool) {
    console.warn("DATABASE_URL is not configured. Auth endpoints will stay unavailable.");
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id SMALLSERIAL PRIMARY KEY,
      name VARCHAR(32) NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    INSERT INTO roles (name) VALUES
      ('passenger'),
      ('driver'),
      ('admin'),
      ('ticket_vendor')
    ON CONFLICT (name) DO NOTHING
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS revoked_tokens (
      jti TEXT PRIMARY KEY,
      expires_at TIMESTAMPTZ NOT NULL
    )
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires ON revoked_tokens (expires_at)`,
  );

  const { rows: userTables } = await pool.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'users'
     ) AS exists`,
  );

  if (!userTables[0]?.exists) {
    await pool.query(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        email VARCHAR(255) UNIQUE,
        phone VARCHAR(30) UNIQUE,
        password_hash TEXT NOT NULL,
        role_id SMALLINT NOT NULL REFERENCES roles (id),
        google_sub TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT users_contact_required CHECK (email IS NOT NULL OR phone IS NOT NULL)
      )
    `);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub
      ON users (google_sub) WHERE google_sub IS NOT NULL
    `);
    await ensureRouteAndBusSchema(pool);
    await ensurePasswordResetTokens(pool);
    return;
  }

  const { rows: userCols } = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users'`,
  );
  const colSet = new Set(userCols.map((r) => r.column_name));
  const hasLegacyRole = colSet.has("role");
  const hasRoleId = colSet.has("role_id");

  if (hasLegacyRole && hasRoleId) {
    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'users_role_valid'
        ) THEN
          ALTER TABLE users DROP CONSTRAINT users_role_valid;
        END IF;
      END $$
    `);
    await pool.query(`ALTER TABLE users DROP COLUMN role`);
  } else if (hasLegacyRole && !hasRoleId) {
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN role_id SMALLINT REFERENCES roles (id)
    `);

    await pool.query(`
      UPDATE users u
      SET role_id = r.id
      FROM roles r
      WHERE u.role::text = r.name
    `);

    await pool.query(`
      UPDATE users
      SET role_id = (SELECT id FROM roles WHERE name = 'passenger' LIMIT 1)
      WHERE role_id IS NULL
    `);

    await pool.query(`
      ALTER TABLE users
      ALTER COLUMN role_id SET NOT NULL
    `);

    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'users_role_valid'
        ) THEN
          ALTER TABLE users DROP CONSTRAINT users_role_valid;
        END IF;
      END $$
    `);

    await pool.query(`ALTER TABLE users DROP COLUMN role`);
  }

  if (!hasRoleId && !hasLegacyRole) {
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN role_id SMALLINT REFERENCES roles (id)
    `);
    await pool.query(`
      UPDATE users
      SET role_id = (SELECT id FROM roles WHERE name = 'passenger' LIMIT 1)
      WHERE role_id IS NULL
    `);
    await pool.query(`
      ALTER TABLE users
      ALTER COLUMN role_id SET NOT NULL
    `);
  }

  await ensureRouteAndBusSchema(pool);
  await ensureFeedbackSchema(pool);
  await ensureGoogleAndPasswordReset(pool);
}

/**
 * google_sub + password_reset_tokens for existing DBs; no-op safe on fresh installs.
 */
async function ensureGoogleAndPasswordReset(db) {
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub TEXT`);
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`);
  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub
    ON users (google_sub) WHERE google_sub IS NOT NULL
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL
    )
  `);
  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_password_reset_expires ON password_reset_tokens (expires_at)`,
  );
}

async function ensurePasswordResetTokens(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL
    )
  `);
  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_password_reset_expires ON password_reset_tokens (expires_at)`,
  );
}

async function ensureRouteAndBusSchema(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS routes (
      id TEXT PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      polyline TEXT NOT NULL,
      distance_meters NUMERIC(14, 2),
      price NUMERIC(12, 2) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_routes_name ON routes (name)`);
  await db.query(
    `ALTER TABLE routes ADD COLUMN IF NOT EXISTS osm_source VARCHAR(64) DEFAULT 'openstreetmap'`,
  );
  await db.query(`ALTER TABLE routes ADD COLUMN IF NOT EXISTS code VARCHAR(16)`);
  await db.query(`ALTER TABLE routes ADD COLUMN IF NOT EXISTS duration_minutes INT`);
  await db.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_routes_code ON routes (code) WHERE code IS NOT NULL`,
  );

  await db.query(`
    CREATE TABLE IF NOT EXISTS stops (
      id TEXT PRIMARY KEY,
      route_id TEXT NOT NULL REFERENCES routes (id) ON DELETE CASCADE,
      sequence_order INT NOT NULL,
      name VARCHAR(200) NOT NULL,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      CONSTRAINT stops_route_sequence_unique UNIQUE (route_id, sequence_order)
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_stops_route_id ON stops (route_id)`);

  await db.query(`
    CREATE TABLE IF NOT EXISTS operators (
      id VARCHAR(32) PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    INSERT INTO operators (id, name) VALUES
      ('ambessa', 'Ambessa'),
      ('addis', 'Addis'),
      ('shega', 'Shega')
    ON CONFLICT (id) DO NOTHING
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS buses (
      id TEXT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(
    `ALTER TABLE buses ADD COLUMN IF NOT EXISTS operator VARCHAR(32)`,
  );
  await db.query(
    `ALTER TABLE buses ADD COLUMN IF NOT EXISTS driver_id TEXT REFERENCES users (id) ON DELETE SET NULL`,
  );
  await db.query(
    `ALTER TABLE buses ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'active'`,
  );
  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_buses_operator ON buses (operator)`,
  );
  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_buses_driver_id ON buses (driver_id)`,
  );

  await db.query(`
    CREATE TABLE IF NOT EXISTS bus_routes (
      bus_id TEXT NOT NULL REFERENCES buses (id) ON DELETE CASCADE,
      route_id TEXT NOT NULL REFERENCES routes (id) ON DELETE CASCADE,
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (bus_id, route_id)
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_bus_routes_route_id ON bus_routes (route_id)`);

  await db.query(`
    ALTER TABLE bus_routes ADD COLUMN IF NOT EXISTS departure_stop_id TEXT
      REFERENCES stops (id) ON DELETE SET NULL
  `);
  await db.query(`
    ALTER TABLE bus_routes ADD COLUMN IF NOT EXISTS arrival_stop_id TEXT
      REFERENCES stops (id) ON DELETE SET NULL
  `);
  await db.query(`
    ALTER TABLE bus_routes ADD COLUMN IF NOT EXISTS departure_time TIME WITHOUT TIME ZONE
  `);
  await db.query(`
    ALTER TABLE bus_routes ADD COLUMN IF NOT EXISTS arrival_time TIME WITHOUT TIME ZONE
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS map_pois (
      id TEXT PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      category VARCHAR(32) NOT NULL,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL
    )
  `);
  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_map_pois_category ON map_pois (category)`,
  );

  await db.query(
    `
    INSERT INTO map_pois (id, name, category, latitude, longitude) VALUES
      ('poi-et-1', 'Meskel Square', 'landmark', 9.0104, 38.7612),
      ('poi-et-2', 'Bole International Airport', 'transport', 8.9779, 38.7993),
      ('poi-et-3', 'Piassa (Addis Ketema)', 'landmark', 9.0337, 38.7500),
      ('poi-et-4', 'Mexico Square', 'landmark', 9.0108, 38.7372),
      ('poi-et-5', 'Arat Kilo', 'landmark', 9.0325, 38.7639),
      ('poi-et-6', 'Mercato', 'shopping', 9.0245, 38.7355),
      ('poi-et-7', 'Kazanchis', 'landmark', 9.0128, 38.7686),
      ('poi-et-8', 'Bole Medhanialem', 'landmark', 8.9976, 38.7864)
    ON CONFLICT (id) DO NOTHING
  `,
  );
  await db.query(`DELETE FROM map_pois WHERE id LIKE 'poi-demo-%'`);
}

async function ensureFeedbackSchema(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS passenger_feedback (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      route_id TEXT REFERENCES routes (id) ON DELETE SET NULL,
      rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
      category VARCHAR(32) NOT NULL DEFAULT 'general',
      comment TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(
    `ALTER TABLE passenger_feedback ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'pending'`,
  );
  await db.query(
    `ALTER TABLE passenger_feedback ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ`,
  );
  await db.query(
    `ALTER TABLE passenger_feedback ADD COLUMN IF NOT EXISTS review_note TEXT`,
  );
  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_passenger_feedback_user ON passenger_feedback (user_id)`,
  );
  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_passenger_feedback_created ON passenger_feedback (created_at DESC)`,
  );
  await db.query(
    `CREATE INDEX IF NOT EXISTS idx_passenger_feedback_status ON passenger_feedback (status)`,
  );
}
