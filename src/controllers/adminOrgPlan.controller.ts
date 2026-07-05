import { Request, Response, NextFunction } from 'express';
import { sendSuccessResponse } from '@/common/helpers';
import { AppError } from '@/common';
import { adminOrgPlanService } from '@/services/adminOrgPlan.service';

export class AdminOrgPlanController {
  listChurch = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const result = await adminOrgPlanService.list('church', page, limit);
      return sendSuccessResponse(res, result);
    } catch (e) {
      next(e);
    }
  };

  listFamily = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const result = await adminOrgPlanService.list('family', page, limit);
      return sendSuccessResponse(res, result);
    } catch (e) {
      next(e);
    }
  };

  createChurch = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const created = await adminOrgPlanService.create(
        'church',
        {
          name: req.body.name,
          totalSeats: req.body.totalSeats,
          usedSeats: req.body.usedSeats,
          billingAdminUserId: req.body.billingAdminUserId,
          metadata: req.body.metadata,
        },
        req.admin!.id,
        req.ip
      );
      return sendSuccessResponse(res, created, 201);
    } catch (e) {
      next(e);
    }
  };

  createFamily = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const created = await adminOrgPlanService.create(
        'family',
        {
          name: req.body.name,
          totalSeats: req.body.totalSeats,
          usedSeats: req.body.usedSeats,
          billingAdminUserId: req.body.billingAdminUserId,
          metadata: req.body.metadata,
        },
        req.admin!.id,
        req.ip
      );
      return sendSuccessResponse(res, created, 201);
    } catch (e) {
      next(e);
    }
  };

  patchChurch = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await adminOrgPlanService.update(
        'church',
        req.params.id,
        req.body,
        req.admin!.id,
        req.ip
      );
      return sendSuccessResponse(res, updated);
    } catch (e) {
      next(e);
    }
  };

  patchFamily = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await adminOrgPlanService.update(
        'family',
        req.params.id,
        req.body,
        req.admin!.id,
        req.ip
      );
      return sendSuccessResponse(res, updated);
    } catch (e) {
      next(e);
    }
  };

  getChurch = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const plan = await adminOrgPlanService.get('church', req.params.id);
      return sendSuccessResponse(res, plan);
    } catch (e) {
      next(e);
    }
  };

  getFamily = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const plan = await adminOrgPlanService.get('family', req.params.id);
      return sendSuccessResponse(res, plan);
    } catch (e) {
      next(e);
    }
  };

  deleteChurch = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await adminOrgPlanService.deactivate(
        'church',
        req.params.id,
        req.admin!.id,
        req.ip
      );
      return sendSuccessResponse(res, updated);
    } catch (e) {
      next(e);
    }
  };

  deleteFamily = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updated = await adminOrgPlanService.deactivate(
        'family',
        req.params.id,
        req.admin!.id,
        req.ip
      );
      return sendSuccessResponse(res, updated);
    } catch (e) {
      next(e);
    }
  };

  getMembers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await adminOrgPlanService.getMembers(req.params.id);
      return sendSuccessResponse(res, result);
    } catch (e) {
      next(e);
    }
  };

  getReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await adminOrgPlanService.getReport(req.params.id);
      return sendSuccessResponse(res, result);
    } catch (e) {
      next(e);
    }
  };

  assignMember = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, tier } = req.body as { userId: string; tier: 'basic' | 'pro' | 'premium' };
      if (!userId) throw new AppError('userId is required', 400);
      if (!['basic', 'pro', 'premium'].includes(tier)) throw new AppError('tier must be basic, pro, or premium', 400);

      const result = await adminOrgPlanService.assignMember(
        req.params.id,
        userId,
        tier,
        req.admin!.id,
        req.ip,
      );
      return sendSuccessResponse(res, result, 201);
    } catch (e) {
      next(e);
    }
  };

  removeMember = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.body as { userId: string };
      if (!userId) throw new AppError('userId is required', 400);

      await adminOrgPlanService.removeMember(
        req.params.id,
        userId,
        req.admin!.id,
        req.ip,
      );
      return sendSuccessResponse(res, { removed: true });
    } catch (e) {
      next(e);
    }
  };

  // ─── Family plan admin ────────────────────────────────────────────────────────

  listFamilyPlans = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const result = await adminOrgPlanService.listFamilyPlans(page, limit);
      return sendSuccessResponse(res, result);
    } catch (e) { next(e); }
  };

  getFamilyPlan = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await adminOrgPlanService.getFamilyPlan(req.params.id);
      return sendSuccessResponse(res, result);
    } catch (e) { next(e); }
  };

  adminRemoveFamilyMember = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.body as { userId: string };
      if (!userId) throw new AppError('userId is required', 400);
      await adminOrgPlanService.adminRemoveFamilyMember(
        req.params.id, userId, req.admin!.id, req.ip,
      );
      return sendSuccessResponse(res, { removed: true });
    } catch (e) { next(e); }
  };

  adminChangeFamilyMemberTier = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, tier } = req.body as { userId: string; tier: string };
      if (!userId) throw new AppError('userId is required', 400);
      if (!['basic', 'pro', 'premium'].includes(tier)) throw new AppError('tier must be basic, pro, or premium', 400);
      const result = await adminOrgPlanService.adminChangeFamilyMemberTier(
        req.params.id, userId, tier as any, req.admin!.id, req.ip,
      );
      return sendSuccessResponse(res, result);
    } catch (e) { next(e); }
  };

  adminDeactivateFamilyPlan = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await adminOrgPlanService.adminDeactivateFamilyPlan(
        req.params.id, req.admin!.id, req.ip,
      );
      return sendSuccessResponse(res, { deactivated: true });
    } catch (e) { next(e); }
  };
}

export const adminOrgPlanController = new AdminOrgPlanController();
