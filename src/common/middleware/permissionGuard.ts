import { Request, Response, NextFunction } from "express";
import { AuthenticatedRequest } from "..";
import { RoleEnum, RBAC } from "../auth/rbac";
import { ForbiddenError } from "..";

export const permissionGuard = (requiredRole: RoleEnum) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    const user = authReq.user;

    if (!user) {
      return next(new ForbiddenError("User not authenticated"));
    }

    next();
  };
};
