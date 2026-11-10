import { randomUUID } from "node:crypto";
import { query } from "../config/database.js";
import { AppError } from "../shared/errors/AppError.js";
import { normalizeEmail } from "../shared/utils/identity.js";
import { isUserRole } from "./UserRole.js";

const userSelect = `SELECT u.id, u.name, u.email, u.phone, u.password_hash, u.google_sub, u.avatar_url, r.name AS role,
       u.created_at, u.updated_at
       FROM users u
       INNER JOIN roles r ON r.id = u.role_id`;

export class PostgresUserRepository {
  async findByGoogleSub(googleSub) {
    const rows = await this.safeQuery(
      `${userSelect}
       WHERE u.google_sub = $1
       LIMIT 1`,
      [googleSub],
    );
    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async findByEmail(email) {
    const rows = await this.safeQuery(
      `${userSelect}
       WHERE u.email = $1
       LIMIT 1`,
      [email],
    );

    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async findByPhone(phone) {
    const rows = await this.safeQuery(
      `${userSelect}
       WHERE u.phone = $1
       LIMIT 1`,
      [phone],
    );

    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async findById(id) {
    const rows = await this.safeQuery(
      `${userSelect}
       WHERE u.id = $1
       LIMIT 1`,
      [id],
    );

    return rows[0] ? this.toDomain(rows[0]) : null;
  }

  async create(input) {
    const roleRows = await this.safeQuery(`SELECT id FROM roles WHERE name = $1 LIMIT 1`, [
      input.role,
    ]);
    const roleId = roleRows[0]?.id;
    if (roleId === undefined) {
      throw new AppError("Invalid role configuration", 500);
    }

    const rows = await this.safeQuery(
      `INSERT INTO users (id, name, email, phone, password_hash, role_id, google_sub)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        input.id,
        input.name,
        input.email,
        input.phone,
        input.passwordHash,
        roleId,
        input.googleSub ?? null,
      ],
    );

    const created = await this.findById(rows[0].id);
    if (!created) {
      throw new AppError("Failed to create user", 500);
    }

    return created;
  }

  async updateProfile(userId, patch) {
    const assignments = [];
    const values = [];
    let i = 1;

    if (patch.name !== undefined) {
      assignments.push(`name = $${i++}`);
      values.push(patch.name);
    }
    if (patch.email !== undefined) {
      assignments.push(`email = $${i++}`);
      values.push(patch.email);
    }
    if (patch.phone !== undefined) {
      assignments.push(`phone = $${i++}`);
      values.push(patch.phone);
    }
    if (patch.passwordHash !== undefined) {
      assignments.push(`password_hash = $${i++}`);
      values.push(patch.passwordHash);
    }
    if (patch.avatarUrl !== undefined) {
      assignments.push(`avatar_url = $${i++}`);
      values.push(patch.avatarUrl);
    }

    if (assignments.length === 0) {
      const u = await this.findById(userId);
      if (!u) {
        throw new AppError("User not found", 404);
      }
      return u;
    }

    assignments.push(`updated_at = NOW()`);
    values.push(userId);

    const rows = await this.safeQuery(
      `UPDATE users u
       SET ${assignments.join(", ")}
       FROM roles r
       WHERE u.id = $${i} AND r.id = u.role_id
       RETURNING u.id, u.name, u.email, u.phone, u.password_hash, u.google_sub, u.avatar_url, r.name AS role,
                 u.created_at, u.updated_at`,
      values,
    );

    if (!rows[0]) {
      throw new AppError("User not found", 404);
    }

    return this.toDomain(rows[0]);
  }

  /**
   * Upsert bootstrap admin: same email becomes admin with the given bcrypt hash (create if missing).
   */
  async bootstrapAdminUser({ email, passwordHash }) {
    const normalized = normalizeEmail(email);
    if (!normalized) {
      throw new AppError("Invalid admin bootstrap email", 500);
    }

    const roles = await this.safeQuery(`SELECT id FROM roles WHERE name = $1 LIMIT 1`, ["admin"]);
    const adminRoleId = roles[0]?.id;
    if (adminRoleId === undefined) {
      throw new AppError("Admin role missing in database", 500);
    }

    const localPart = normalized.split("@")[0] ?? "";
    const derivedName =
      localPart.trim().length >= 2 ? localPart.trim() : normalized.slice(0, 120);

    const rows = await this.safeQuery(`${userSelect} WHERE u.email = $1 LIMIT 1`, [normalized]);
    const existingId = rows[0]?.id;

    if (existingId) {
      await this.safeQuery(
        `UPDATE users SET password_hash = $1, role_id = $2, updated_at = NOW() WHERE id = $3`,
        [passwordHash, adminRoleId, existingId],
      );
      return { created: false, userId: existingId };
    }

    const insert = await this.safeQuery(
      `INSERT INTO users (id, name, email, phone, password_hash, role_id, google_sub)
       VALUES ($1, $2, $3, NULL, $4, $5, NULL)
       RETURNING id`,
      [
        randomUUID(),
        derivedName,
        normalized,
        passwordHash,
        adminRoleId,
      ],
    );

    const id = insert[0]?.id;
    if (!id) {
      throw new AppError("Failed to create bootstrap admin user", 500);
    }
    return { created: true, userId: id };
  }

  async updateGoogleSub(userId, googleSub) {
    await this.safeQuery(`UPDATE users SET google_sub = $1, updated_at = NOW() WHERE id = $2`, [
      googleSub,
      userId,
    ]);
    const u = await this.findById(userId);
    if (!u) {
      throw new AppError("User not found", 404);
    }
    return u;
  }

  async listByRole(role) {
    const rows = await this.safeQuery(
      `${userSelect}
       WHERE r.name = $1
       ORDER BY u.name`,
      [role],
    );
    return rows.map((row) => this.toPublicDomain(row));
  }

  toPublicDomain(row) {
    if (!isUserRole(row.role)) {
      throw new AppError("Invalid role stored for user", 500);
    }
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      role: row.role,
      avatarUrl: row.avatar_url ?? null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
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

  toDomain(row) {
    if (!isUserRole(row.role)) {
      throw new AppError("Invalid role stored for user", 500);
    }

    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      passwordHash: row.password_hash,
      googleSub: row.google_sub ?? null,
      role: row.role,
      avatarUrl: row.avatar_url ?? null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
