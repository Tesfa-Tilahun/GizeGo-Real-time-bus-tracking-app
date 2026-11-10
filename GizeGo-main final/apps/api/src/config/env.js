import dotenv from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Resolve `apps/api/.env` from this file (`src/config/env.js`) regardless of shell cwd */
const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
dotenv.config({ path: join(apiRoot, ".env") });

export const env = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl: process.env.DATABASE_URL ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "change-me-in-production",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  /** Public origin for Swagger "Try it out" (no trailing slash). */
  publicBaseUrl: (process.env.PUBLIC_BASE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  ),
  /** Dev only: include plain reset token in POST /auth/forgot-password JSON */
  passwordResetReturnToken: process.env.PASSWORD_RESET_RETURN_TOKEN === "true",
  /** Comma-separated Google OAuth client IDs (Web + iOS + Android) that may mint ID tokens you accept */
  googleClientIds: (process.env.GOOGLE_OAUTH_CLIENT_IDS ?? "")
    .trim()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  /** SMTP for password-reset emails. Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD (and MAIL_FROM). */
  smtp: {
    host: (process.env.SMTP_HOST ?? "").trim(),
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    user: (process.env.SMTP_USER ?? "").trim(),
    pass: (process.env.SMTP_PASSWORD ?? "").trim(),
    from:
      (process.env.MAIL_FROM ?? "").trim() || "GizeGo <noreply@gizego.local>",
  },
  /** Optional: Google Cloud Translation API key (Language > translate v2). Public route uses it for en↔am. */
  googleCloudTranslationsApiKey: (process.env.GOOGLE_CLOUD_TRANSLATIONS_API_KEY ?? "").trim(),
  /**
   * If both are set at startup (after migrations), ensures this email exists with role admin and this password hash.
   * Does not expose values in logs. Omit in production unless you deliberately want a repeatable bootstrap.
   */
  adminBootstrap: {
    email: (process.env.ADMIN_BOOTSTRAP_EMAIL ?? "").trim(),
    password: process.env.ADMIN_BOOTSTRAP_PASSWORD ?? "",
  },
};
