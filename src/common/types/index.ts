import { Request, Response, NextFunction } from "express";
import { RoleEnum } from "../auth/rbac";
import { User } from "@/database/entities";
import {
  FindOptionsOrder,
  FindOptionsRelations,
  FindOptionsWhere,
} from "typeorm";
import { ACCOUNT_STATUS } from "../constants";

export interface UserPayload {
  userId: string;
  email: string;
  accountStatus: ACCOUNT_STATUS;
}

export type DecodedToken<T extends UserPayload> = {
  iat: number;
  exp: number;
} & T;

export interface ServiceResponse<T> {
  success: boolean;
  message?: string;
  response?: T;
  error?: {
    message: string;
    code?: string | unknown;
  };
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    hasMore: boolean;
    limit: number;
    totalPages: number;
  };
}
export interface BaseFilterOptions<T> {
  page?: number;
  limit?: number;
  search?: string;
  options?: {
    order?: FindOptionsOrder<T>;
    where?: FindOptionsWhere<T> | FindOptionsWhere<T>[];
    relations?: FindOptionsRelations<T>;
  };
}

export type FilterOptions<T> = BaseFilterOptions<T> & Record<string, any>;

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 100;

export interface AuthenticatedRequest extends Request {
  user?: User;
  role?: RoleEnum;
}

export const getFilterOptions = (query: any) => {
  const { page = 1, limit = 10, sort, search, ...filters } = query;
  return {
    page: page as number,
    limit: limit as number,
    sort: sort as string,
    search: search as string,
    filters,
  };
};

export interface Config {
  NODE_ENV: "development" | "production" | "test";
  PORT: number;
  SERVICE_NAME: string;
  JWT_PRIVATE_KEY: string;
  JWT_PUBLIC_KEY: string;
  JWT_EXPIRES_IN: string;
  LOG_LEVEL: "fatal" | "error" | "warn" | "info" | "debug" | "trace";
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD?: string;
  REDIS_DB?: number;
  REDIS_KEY_PREFIX?: string;
}

export type TokenResponse = {
  accessToken: string;
  refreshToken: string;
  isEmailVerified?: boolean;
  accountStatus?: string;
};

export type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void> | void;
