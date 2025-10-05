import { Response } from "express";
import { ServiceResponse } from "../types";

/**
 * Creates a success service response
 * @param data - The data to include in the response
 * @returns ServiceResponse with success: true and the provided data
 */
export function createSuccessResponse<T>(data: T): ServiceResponse<T> {
  return {
    success: true,
    response: data,
  };
}

/**
 * Creates an error service response
 * @param message - Error message
 * @param code - Optional error code
 * @returns ServiceResponse with success: false and error details
 */
export function createErrorResponse(
  message: string,
  code?: string | unknown
): ServiceResponse<never> {
  return {
    success: false,
    error: {
      message,
      code,
    },
  };
}

/**
 * Sends a success response to the client
 * @param res - Express response object
 * @param data - The data to send
 * @param statusCode - HTTP status code (default: 200)
 */
export function sendSuccessResponse<T>(
  res: Response,
  data: T,
  statusCode: number = 200
): Promise<ServiceResponse<T>> {
  const response = createSuccessResponse(data);
  res.status(statusCode).json(response);
  return Promise.resolve(response);
}

/**
 * Sends an error response to the client
 * @param res - Express response object
 * @param message - Error message
 * @param statusCode - HTTP status code (default: 400)
 * @param code - Optional error code
 */
export function sendErrorResponse(
  res: Response,
  message: string,
  statusCode: number = 400,
  code?: string | unknown
): void {
  const response = createErrorResponse(message, code);
  res.status(statusCode).json(response);
}

/**
 * Sends a paginated response to the client
 * @param res - Express response object
 * @param data - Paginated data
 * @param statusCode - HTTP status code (default: 200)
 */
export function sendPaginatedResponse<T>(
  res: Response,
  data: T,
  statusCode: number = 200
): void {
  const response = createSuccessResponse(data);
  res.status(statusCode).json(response);
}

/**
 * Sends a "not found" error response
 * @param res - Express response object
 * @param message - Error message (default: "Resource not found")
 */
export function sendNotFoundResponse(
  res: Response,
  message: string = "Resource not found"
): void {
  sendErrorResponse(res, message, 404);
}

/**
 * Sends an "unauthorized" error response
 * @param res - Express response object
 * @param message - Error message (default: "Unauthorized")
 */
export function sendUnauthorizedResponse(
  res: Response,
  message: string = "Unauthorized"
): void {
  sendErrorResponse(res, message, 401);
}

/**
 * Sends a "forbidden" error response
 * @param res - Express response object
 * @param message - Error message (default: "Forbidden")
 */
export function sendForbiddenResponse(
  res: Response,
  message: string = "Forbidden"
): void {
  sendErrorResponse(res, message, 403);
}

/**
 * Sends a "bad request" error response
 * @param res - Express response object
 * @param message - Error message (default: "Bad request")
 */
export function sendBadRequestResponse(
  res: Response,
  message: string = "Bad request"
): void {
  sendErrorResponse(res, message, 400);
}

/**
 * Sends an "internal server error" response
 * @param res - Express response object
 * @param message - Error message (default: "Internal server error")
 */
export function sendInternalServerErrorResponse(
  res: Response,
  message: string = "Internal server error"
): void {
  sendErrorResponse(res, message, 500);
}
