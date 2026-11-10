import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "../shared/errors/AppError.js";
import { isUserRole } from "../models/UserRole.js";

export class JwtTokenService {
  constructor(revokedTokens) {
    this.revokedTokens = revokedTokens;
  }

  sign(input) {
    const options = {
      expiresIn: env.jwtExpiresIn,
    };

    const jti = randomUUID();
    return jwt.sign(
      { sub: input.sub, role: input.role, jti },
      env.jwtSecret,
      options,
    );
  }

  async verify(token) {
    try {
      const decoded = jwt.verify(token, env.jwtSecret);

      if (
        typeof decoded !== "object" ||
        decoded === null ||
        typeof decoded.sub !== "string" ||
        typeof decoded.jti !== "string" ||
        !isUserRole(decoded.role)
      ) {
        throw new AppError("Invalid token payload", 401);
      }

      if (typeof decoded.exp !== "number") {
        throw new AppError("Invalid token payload", 401);
      }

      const expiresAt = new Date(decoded.exp * 1000);

      if (await this.revokedTokens.isRevoked(decoded.jti)) {
        throw new AppError("Token has been revoked", 401);
      }

      return {
        sub: decoded.sub,
        role: decoded.role,
        jti: decoded.jti,
        expiresAt,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError("Invalid or expired token", 401);
    }
  }

  async revokeToken(jti, expiresAt) {
    await this.revokedTokens.revoke(jti, expiresAt);
  }
}
