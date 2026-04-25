import { Request, Response, NextFunction } from 'express';
import { sendSuccessResponse } from '@/common/helpers';
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
}

export const adminOrgPlanController = new AdminOrgPlanController();
