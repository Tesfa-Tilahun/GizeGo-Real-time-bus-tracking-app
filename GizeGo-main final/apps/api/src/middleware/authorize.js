import { AppError } from "../shared/errors/AppError.js";

export function authorize(...allowedRoles) {
  return (req, _res, next) => {
    const currentRole = req.authUser?.role;

    if (!currentRole) {
      next(new AppError("User is not authenticated", 401));
      return;
    }

    if (!allowedRoles.includes(currentRole)) {
      next(new AppError("Access denied", 403));
      return;
    }

    next();
  };
}
