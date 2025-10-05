export const ErrorMessages = {
  // Auth errors
  INVALID_TOKEN: "Invalid or expired token",
  NO_TOKEN: "No token provided",
  ACCESS_DENIED: "Access denied",
  INSUFFICIENT_PERMISSIONS: "Insufficient permissions",

  // Validation errors
  INVALID_INPUT: "Invalid input data",
  REQUIRED_FIELD: "Required field missing",
  INVALID_FORMAT: "Invalid data format",

  // Resource errors
  NOT_FOUND: "Resource not found",
  ALREADY_EXISTS: "Resource already exists",
  CONFLICT: "Resource conflict",

  // System errors
  INTERNAL_ERROR: "Internal server error",
  SERVICE_UNAVAILABLE: "Service temporarily unavailable",
  DATABASE_ERROR: "Database operation failed",
  EXTERNAL_SERVICE_ERROR: "External service error",
} as const;

export const StatusCodes = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

export * from "./role";
export * from "./options";
