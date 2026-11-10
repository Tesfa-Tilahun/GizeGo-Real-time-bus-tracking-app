import { AppError } from "../shared/errors/AppError.js";

export function authenticate(tokenService) {
  return async (req, _res, next) => {
    try {
      const authorizationHeader = req.headers.authorization;

      if (!authorizationHeader?.startsWith("Bearer ")) {
        next(new AppError("Authorization token is required", 401));
        return;
      }

      const token = authorizationHeader.replace("Bearer ", "").trim();
      const payload = await tokenService.verify(token);

      req.authUser = {
        userId: payload.sub,
        role: payload.role,
        jti: payload.jti,
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}
