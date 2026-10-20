import { Request, Response, NextFunction } from 'express';
import { sendSuccessResponse } from '@/common/helpers';
import { AdminChurchPortalService } from '@/services/adminChurchPortal.service';
import { ChurchPortalMembersService } from '@/church-portal/services/churchPortalMembers.service';
import { adminAuditService } from '@/services/adminAudit.service';
import { assertAdminPermission } from '@/admin/middleware/requireAdminPermission.middleware';
import {
  createChurchPortalSchema,
  updateChurchPortalSchema,
  createChurchPortalUserSchema,
  listChurchPortalsQuerySchema,
} from '@/validation/adminChurchPortals.validation';

export class AdminChurchPortalController {
  private readonly membersService = new ChurchPortalMembersService();

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
      if (body.status !== undefined) {
        await assertAdminPermission(req, 'church.suspend');
      }
      const before = body.status !== undefined ? await this.service.getPortal(req.params.portalId) : null;
      const result = await this.service.updatePortal(req.params.portalId, body);
      if (before && before.status !== result.status) {
        await adminAuditService.log({
          adminUserId: req.admin!.id,
          action: result.status === 'suspended' ? 'admin.church_portal.suspend' : 'admin.church_portal.reactivate',
          targetType: 'church_portal',
          targetId: result.id,
          metadata: { name: result.name },
          ip: req.ip ?? null,
        });
      }
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

  removeMember = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await assertAdminPermission(req, 'church.remove_members');
      const result = await this.membersService.removeMember(req.params.portalId, req.params.userId);
      await adminAuditService.log({
        adminUserId: req.admin!.id,
        action: 'admin.church_portal.remove_member',
        targetType: 'user',
        targetId: req.params.userId,
        metadata: { churchPortalId: req.params.portalId },
        ip: req.ip ?? null,
      });
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
