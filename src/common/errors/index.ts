import { Request, Response } from "express";
import { ZodError } from "zod";
import { Logger } from "../logger";

const logger = new Logger({ level: "info", service: "error-handler" });

export class AppError extends Error {
  constructor(
    message: string,
    public status: number = 500,
    public code: string = "INTERNAL_SERVER_ERROR",
    public details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (err: Error, req: Request, res: Response): void => {
  // Handle operational errors (AppError)
  if (err instanceof AppError) {
    logger.warn("Operational error:", {
      statusCode: err.status,
      message: err.message,
      path: req.path,
      method: req.method,
      stack: err.stack,
      body: req.body,
      query: req.query,
      params: req.params,
    });

    res.status(err.status).json({
      status: "error",
      message: err.message,
      code: err.code,
    });
    return;
  }

  // Handle validation errors (ZodError)

  if (err instanceof ZodError) {
    logger.warn("Validation error:", {
      errors: err.errors,
      path: req.path,
      method: req.method,
      body: req.body,
      query: req.query,
      params: req.params,
    });

    res.status(400).json({
      status: "error",
      message: "Validation error",
      errors: err.errors.map((error) => ({
        field: error.path.join("."),
        message: error.message,
      })),
    });
    return;
  }

  // Handle TypeORM errors
  if (err.name === "QueryFailedError") {
    logger.error("Database error:", err, {
      stack: err.stack,
      path: req.path,
      method: req.method,
      body: req.body,
      query: req.query,
      params: req.params,
    });

    res.status(500).json({
      status: "error",
      message: "Database operation failed",
    });
    return;
  }

  // Log unexpected errors
  logger.error("Unexpected error:", err, {
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    query: req.query,
    params: req.params,
  });

  // Don't expose internal errors in production
  const isDevelopment = process.env.NODE_ENV === "development";
  res.status(500).json({
    status: "error",
    message: isDevelopment ? err.message : "Internal server error",
    ...(isDevelopment && { stack: err.stack }),
  });
};

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}
export class InternalServerError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 500, "INTERNAL_SERVER_ERROR", details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden") {
    super(message, 403, "FORBIDDEN");
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Not found") {
    super(message, 404, "NOT_FOUND");
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "CONFLICT");
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message: string = "Too many requests") {
    super(message, 429, "TOO_MANY_REQUESTS");
  }
}
