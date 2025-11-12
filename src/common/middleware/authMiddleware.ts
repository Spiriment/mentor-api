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

      // User entity has role as a column (enum), not a relation, so don't load relations
      const user = await stationUserRepository.findOne({
        where: {
          id: decoded.userId,
        },
        // Remove relations - User.role is a column, not a relation
        // relations: ["role", "role.permissions"],
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
      // Log the actual error for debugging
      console.error("Auth middleware error:", {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      
      // Provide more specific error messages
      if (error.name === "TokenExpiredError" || error.message?.includes("expired")) {
        next(new UnauthorizedError("Token has expired"));
      } else if (error.name === "JsonWebTokenError" || error.message?.includes("jwt")) {
        next(new UnauthorizedError("Invalid token format"));
      } else if (error.message?.includes("User not found")) {
        next(new UnauthorizedError("User not found"));
      } else {
        // Generic invalid token for other errors
        next(new UnauthorizedError(`Invalid token: ${error.message || "Unknown error"}`));
      }
    }
  };
};
