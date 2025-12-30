import { Request, Response, NextFunction } from "express";
import { AuthenticatedRequest, UserPayload } from "../types";
import { JwtService } from "../auth/jwt";
import { UnauthorizedError } from "../errors";
import { AppDataSource } from "@/config/data-source";
import { User } from "@/database/entities";
import { ACCOUNT_STATUS } from "../constants/options";

declare module "express" {
  interface Request {
    user?: AuthenticatedRequest["user"];
  }
}

export const authMiddleware = (jwtService: JwtService) => {
  return async (
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction
  ) => {
    try {
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) {
        throw new UnauthorizedError("No token provided");
      }

      const decoded = jwtService.verify<UserPayload>(token);
      const stationUserRepository = AppDataSource.getRepository(User);

      const user = await stationUserRepository.findOne({
        where: {
          id: decoded.userId,
        },
        // Note: User entity has 'role' as a column (enum), not a relation
        // No relations need to be loaded for authentication
      });

      if (!user) {
        throw new UnauthorizedError("User not found");
      }

      if (user.accountStatus === ACCOUNT_STATUS.SUSPENDED) {
        throw new UnauthorizedError("User account is suspended");
      }

      req.user = user;

      next();
    } catch (error: any) {
      next(new UnauthorizedError("Invalid token"));
    }
  };
};
