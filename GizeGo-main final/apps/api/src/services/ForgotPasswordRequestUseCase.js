import { env } from "../config/env.js";

export class ForgotPasswordRequestUseCase {
  constructor(userRepository, passwordResetRepository, passwordResetMailer) {
    this.userRepository = userRepository;
    this.passwordResetRepository = passwordResetRepository;
    this.passwordResetMailer = passwordResetMailer;
  }

  /**
   * Creates a one-time token (stored hashed). Does not reveal whether email exists.
   * Sends email via SMTP when configured. In development without SMTP, logs the token once.
   * Set PASSWORD_RESET_RETURN_TOKEN=true to also return devResetToken in JSON (dev only).
   */
  async execute(email) {
    const normalized = email?.trim().toLowerCase();
    const genericMessage =
      "If an account exists for this email, you will receive password reset instructions shortly.";

    if (!normalized) {
      return { message: genericMessage };
    }

    const user = await this.userRepository.findByEmail(normalized);
    const out = { message: genericMessage };

    if (!user?.email) {
      return out;
    }

    const { plainToken, expiresAt } = await this.passwordResetRepository.createForUser(user.id);

    if (this.passwordResetMailer?.isConfigured()) {
      try {
        await this.passwordResetMailer.sendPasswordResetEmail({
          to: user.email,
          name: user.name ?? null,
          plainToken,
          expiresAt,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[gizego] Password reset email failed:", msg);
        if (err && typeof err === "object") {
          const ne = /** @type {{ response?: string; responseCode?: string; code?: string }} */ (err);
          if (ne.response != null) console.error("[gizego] SMTP response:", ne.response);
          if (ne.responseCode != null) console.error("[gizego] SMTP responseCode:", ne.responseCode);
          if (ne.code != null) console.error("[gizego] Error code:", ne.code);
        }
      }
    } else if (env.nodeEnv === "development") {
      console.warn(
        "[gizego] SMTP not configured — reset email not sent. Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD, MAIL_FROM in .env.\n" +
          `         (dev) token for ${user.email}: ${plainToken}`,
      );
    }

    if (env.passwordResetReturnToken) {
      out.devResetToken = plainToken;
      out.devHint =
        "devResetToken is included because PASSWORD_RESET_RETURN_TOKEN=true — never enable in production.";
    }

    return out;
  }
}
