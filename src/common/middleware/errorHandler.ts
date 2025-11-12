import { Request, Response, NextFunction } from "express";
import { AppError, ValidationError } from "../errors";
import { Logger } from "../logger";

export const errorHandler = (logger: Logger) => {
  return (error: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error("Error occurred:", error, {
      requestPath: _req.path,
      requestMethod: _req.method,
      requestBody: _req.body,
    });

    // Handle payload too large error specifically
    if (error.name === "PayloadTooLargeError") {
      return res.status(413).json({
        success: false,
        error: {
          message:
            "Request payload too large. Please reduce the size of your data.",
          code: "PAYLOAD_TOO_LARGE",
        },
      });
    }

    if (error instanceof AppError) {
      // For ValidationError, include the detailed validation errors
      if (error instanceof ValidationError && error.details) {
        return res.status(error.status).json({
          success: false,
          error: {
            message: error.message,
            code: error.code,
            details: error.details,
          },
        });
      }
      
      return res.status(error.status).json({
        success: false,
        error: {
          message: error.message,
          code: error.code || error.status,
          ...(error.details && typeof error.details === "object"
            ? { details: error.details }
            : {}),
        },
      });
    }

    // Handle unexpected errors
    return res.status(500).json({
      success: false,
      error: {
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      },
    });
  };
};
