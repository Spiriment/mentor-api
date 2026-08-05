import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { adminOrgPlanService } from '@/services/adminOrgPlan.service';

export class ChurchPortalBillingController {
  getPreview = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await adminOrgPlanService.getChurchInvoicePreviewForPortal(
        req.churchPortalUser!.churchPortalId,
      );
      res.status(StatusCodes.OK).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };

  generateInvoice = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const portalUser = req.churchPortalUser!;
      const data = await adminOrgPlanService.generateChurchInvoiceFromPortal(
        portalUser.churchPortalId,
        {
          id: portalUser.id,
          email: portalUser.email,
          firstName: portalUser.firstName,
          lastName: portalUser.lastName,
        },
        req.ip,
      );
      res.status(StatusCodes.CREATED).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };
}
