import { query } from "../config/database.js";
import { AppError } from "../shared/errors/AppError.js";

export class PostgresFeedbackRepository {
  async create(input) {
    const rows = await this.safeQuery(
      `INSERT INTO passenger_feedback (id, user_id, route_id, rating, category, comment, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING id, user_id, route_id, rating, category, comment, status, created_at, reviewed_at, review_note`,
      [
        input.id,
        input.userId,
        input.routeId ?? null,
        input.rating,
        input.category ?? "general",
        input.comment,
      ],
    );
    return this.toDomain(rows[0]);
  }

  async listByUserId(userId, limit = 20) {
    const rows = await this.safeQuery(
      `SELECT f.id, f.user_id, f.route_id, f.rating, f.category, f.comment,
              f.status, f.created_at, f.reviewed_at, f.review_note,
              r.name AS route_name
       FROM passenger_feedback f
       LEFT JOIN routes r ON r.id = f.route_id
       WHERE f.user_id = $1
       ORDER BY f.created_at DESC
       LIMIT $2`,
      [userId, limit],
    );
    return rows.map((r) => this.toDomain(r));
  }

  async listForAdmin({ status, routeId, limit = 100, offset = 0 } = {}) {
    const conditions = [];
    const params = [];
    let i = 1;

    if (status && status !== "all") {
      conditions.push(`f.status = $${i++}`);
      params.push(status);
    }
    if (routeId) {
      conditions.push(`f.route_id = $${i++}`);
      params.push(routeId);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(limit, offset);

    const rows = await this.safeQuery(
      `SELECT f.id, f.user_id, f.route_id, f.rating, f.category, f.comment,
              f.status, f.created_at, f.reviewed_at, f.review_note,
              u.name AS user_name, u.email AS user_email,
              r.name AS route_name
       FROM passenger_feedback f
       INNER JOIN users u ON u.id = f.user_id
       LEFT JOIN routes r ON r.id = f.route_id
       ${where}
       ORDER BY f.created_at DESC
       LIMIT $${i++} OFFSET $${i}`,
      params,
    );
    return rows.map((r) => this.toAdminDomain(r));
  }

  async findById(id) {
    const rows = await this.safeQuery(
      `SELECT f.id, f.user_id, f.route_id, f.rating, f.category, f.comment,
              f.status, f.created_at, f.reviewed_at, f.review_note,
              u.name AS user_name, u.email AS user_email,
              r.name AS route_name
       FROM passenger_feedback f
       INNER JOIN users u ON u.id = f.user_id
       LEFT JOIN routes r ON r.id = f.route_id
       WHERE f.id = $1`,
      [id],
    );
    return rows[0] ? this.toAdminDomain(rows[0]) : null;
  }

  async updateReview(id, { status, reviewNote }) {
    const rows = await this.safeQuery(
      `UPDATE passenger_feedback
       SET status = $2,
           review_note = $3,
           reviewed_at = NOW()
       WHERE id = $1
       RETURNING id, user_id, route_id, rating, category, comment, status, created_at, reviewed_at, review_note`,
      [id, status, reviewNote ?? null],
    );
    if (rows.length === 0) return null;
    return this.findById(id);
  }

  async getAnalytics({ sinceMs, routeId } = {}) {
    const since = new Date(Date.now() - (sinceMs ?? 24 * 60 * 60 * 1000));
    const params = [since.toISOString()];
    let routeFilter = "";
    if (routeId) {
      routeFilter = " AND route_id = $2";
      params.push(routeId);
    }

    const summaryRows = await this.safeQuery(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
         COUNT(*) FILTER (WHERE status = 'accepted')::int AS accepted,
         COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected,
         ROUND(AVG(rating)::numeric, 2) AS avg_rating
       FROM passenger_feedback
       WHERE created_at >= $1${routeFilter}`,
      params,
    );

    const categoryRows = await this.safeQuery(
      `SELECT category, COUNT(*)::int AS count
       FROM passenger_feedback
       WHERE created_at >= $1${routeFilter}
       GROUP BY category
       ORDER BY count DESC`,
      params,
    );

    const ratingRows = await this.safeQuery(
      `SELECT rating, COUNT(*)::int AS count
       FROM passenger_feedback
       WHERE created_at >= $1${routeFilter}
       GROUP BY rating
       ORDER BY rating`,
      params,
    );

    const trendRows = await this.safeQuery(
      `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
              COUNT(*)::int AS count,
              ROUND(AVG(rating)::numeric, 2) AS avg_rating
       FROM passenger_feedback
       WHERE created_at >= $1${routeFilter}
       GROUP BY day
       ORDER BY day`,
      params,
    );

    const summary = summaryRows[0] ?? {};
    return {
      total: summary.total ?? 0,
      pending: summary.pending ?? 0,
      accepted: summary.accepted ?? 0,
      rejected: summary.rejected ?? 0,
      avgRating: summary.avg_rating != null ? Number(summary.avg_rating) : null,
      byCategory: categoryRows.map((r) => ({
        category: r.category,
        count: r.count,
      })),
      byRating: ratingRows.map((r) => ({
        rating: r.rating,
        count: r.count,
      })),
      trend: trendRows.map((r) => ({
        day: r.day,
        count: r.count,
        avgRating: r.avg_rating != null ? Number(r.avg_rating) : null,
      })),
    };
  }

  toDomain(row) {
    return {
      id: row.id,
      userId: row.user_id,
      routeId: row.route_id ?? undefined,
      routeName: row.route_name ?? undefined,
      rating: row.rating,
      category: row.category,
      comment: row.comment,
      status: row.status ?? "pending",
      createdAt: new Date(row.created_at),
      reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : undefined,
      reviewNote: row.review_note ?? undefined,
    };
  }

  toAdminDomain(row) {
    return {
      ...this.toDomain(row),
      userName: row.user_name,
      userEmail: row.user_email ?? undefined,
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
