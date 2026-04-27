import { Request, Response, NextFunction } from 'express';
import { sendSuccessResponse } from '@/common/helpers';
import { AdminChurchPortalService } from '@/services/adminChurchPortal.service';
import {
  createChurchPortalSchema,
  updateChurchPortalSchema,
  createChurchPortalUserSchema,
  listChurchPortalsQuerySchema,
} from '@/validation/adminChurchPortals.validation';

export class AdminChurchPortalController {
  constructor(private readonly service: AdminChurchPortalService) {}

  // ── Portals ──────────────────────────────────────────────────────────────

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = listChurchPortalsQuerySchema.parse(req.query);
      const result = await this.service.listPortals(query);
      return sendSuccessResponse(res, result);
    } catch (e) {
      next(e);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getPortal(req.params.portalId);
      return sendSuccessResponse(res, result);
    } catch (e) {
      next(e);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createChurchPortalSchema.parse(req.body);
      const result = await this.service.createPortal(body);
      return sendSuccessResponse(res, result, 201);
    } catch (e) {
      next(e);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = updateChurchPortalSchema.parse(req.body);
      const result = await this.service.updatePortal(req.params.portalId, body);
      return sendSuccessResponse(res, result);
    } catch (e) {
      next(e);
    }
  };

  // ── Portal Users (pastor logins) ─────────────────────────────────────────

  listUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.listPortalUsers(req.params.portalId);
      return sendSuccessResponse(res, result);
    } catch (e) {
      next(e);
    }
  };

  createUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createChurchPortalUserSchema.parse(req.body);
      const result = await this.service.createPortalUser(req.params.portalId, body);
      return sendSuccessResponse(res, result, 201);
    } catch (e) {
      next(e);
    }
  };

  deactivateUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.deactivatePortalUser(req.params.portalId, req.params.userId);
      return sendSuccessResponse(res, result);
    } catch (e) {
      next(e);
    }
  };

  reactivateUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.reactivatePortalUser(req.params.portalId, req.params.userId);
      return sendSuccessResponse(res, result);
    } catch (e) {
      next(e);
    }
  };

  resendInvite = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.resendInvite(req.params.portalId, req.params.userId);
      return sendSuccessResponse(res, result);
    } catch (e) {
      next(e);
    }
  };

  // ── App Members ──────────────────────────────────────────────────────────

  listMembers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { role, page, limit } = req.query as Record<string, string>;
      const result = await this.service.listPortalMembers(
        req.params.portalId,
        role,
        page ? parseInt(page) : 1,
        limit ? parseInt(limit) : 20
      );
      return sendSuccessResponse(res, result);
    } catch (e) {
      next(e);
    }
  };

  getReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.getPortalReport(req.params.portalId);
      return sendSuccessResponse(res, result);
    } catch (e) {
      next(e);
    }
  };
}
