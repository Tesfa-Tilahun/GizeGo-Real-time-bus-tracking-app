import nodemailer from "nodemailer";
import { env } from "../config/env.js";

export class SmtpPasswordResetMailer {
  isConfigured() {
    const { host, user, pass } = env.smtp;
    return Boolean(host && user && pass);
  }

  /**
   * @param {{ to: string; name: string | null; plainToken: string; expiresAt: Date }} p
   */
  async sendPasswordResetEmail({ to, name, plainToken, expiresAt }) {
    const transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: { user: env.smtp.user, pass: env.smtp.pass },
    });

    const who = (name || "there").trim() || "there";
    const expiryNote = `This code expires at ${expiresAt.toUTCString()}.`;

    const text = [
      `Hi ${who},`,
      "",
      "We received a request to reset your GizeGo password.",
      "",
      "Open the GizeGo app, go to the login screen, tap \"I have a reset code\" (or use Forgot password and then Enter reset code), and paste this one-time code:",
      "",
      plainToken,
      "",
      expiryNote,
      "",
      "If you did not ask to reset your password, you can ignore this email.",
    ].join("\n");

    await transporter.sendMail({
      from: env.smtp.from,
      to,
      subject: "Reset your GizeGo password",
      text,
    });
  }
}
