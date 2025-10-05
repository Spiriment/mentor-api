import { Request, Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../types";
import { ForbiddenError } from "../errors";
import { RoleEnum } from "../auth/rbac";

export const roleGuard = (allowedRoles: RoleEnum[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      return next(new ForbiddenError("User not authenticated"));
    }

    next();
  };
};
