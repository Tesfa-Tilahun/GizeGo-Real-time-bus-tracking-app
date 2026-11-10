import { OAuth2Client } from "google-auth-library";
import { env } from "../config/env.js";
import { AppError } from "../shared/errors/AppError.js";

const client = new OAuth2Client();

export async function verifyGoogleIdToken(idToken) {
  if (!env.googleClientIds.length) {
    throw new AppError(
      "Google sign-in is not configured (set GOOGLE_OAUTH_CLIENT_IDS on the API server)",
      503,
    );
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: env.googleClientIds,
    });
    const p = ticket.getPayload();
    if (!p?.sub || !p.email) {
      throw new AppError("Invalid Google token", 401);
    }
    return {
      sub: p.sub,
      email: p.email.trim().toLowerCase(),
      name: (p.name || p.email.split("@")[0] || "User").trim().slice(0, 120),
    };
  } catch (e) {
    if (e instanceof AppError) throw e;
    if (env.nodeEnv !== "production") {
      console.error("[gizego] Google verifyIdToken failed:", e instanceof Error ? e.message : String(e));
    }
    throw new AppError("Invalid or expired Google token", 401);
  }
}
