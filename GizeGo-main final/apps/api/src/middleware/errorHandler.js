import { ZodError } from "zod";
import { AppError } from "../shared/errors/AppError.js";

export function errorHandler(error, _req, res, _next) {
  if (error instanceof ZodError) {
    res.status(422).json({
      message: "Validation failed",
      errors: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      message: error.message,
    });
    return;
  }

  console.error(error);
  res.status(500).json({
    message: "Internal server error",
  });
}
