import { RequestHandler } from 'express';

/** Placeholder until the route is implemented (see docs/ADMIN_BACKEND_IMPLEMENTATION_PLAN.md). */
export const adminNotImplemented: RequestHandler = (_req, res) => {
  res.status(501).json({
    success: false,
    error: { message: 'Admin API not implemented yet' },
  });
};
