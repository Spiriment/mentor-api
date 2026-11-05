import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ForbiddenError } from '@/common/errors';
import { adminOrgPlanService } from '@/services/adminOrgPlan.service';
import { CHURCH_PORTAL_USER_ROLE } from '../entities/churchPortalUser.entity';

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
      // A real invoice goes out to be paid, so it's a billing change like the others
      if (portalUser.role !== CHURCH_PORTAL_USER_ROLE.PASTOR) {
        throw new ForbiddenError('Only pastors can generate invoices.');
      }
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
