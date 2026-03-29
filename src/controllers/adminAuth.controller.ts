import { Request, Response, NextFunction } from 'express';
import { sendSuccessResponse } from '@/common/helpers';
import { Logger } from '@/common';
import { AdminAuthService } from '@/services/adminAuth.service';
import { adminAuditService } from '@/services/adminAudit.service';

export class AdminAuthController {
  private logger = new Logger({
    level: (process.env.LOG_LEVEL as 'info') || 'info',
    service: 'admin-auth-controller',
  });

  constructor(private readonly adminAuthService: AdminAuthService) {}

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      const result = await this.adminAuthService.login(email, password);
      try {
        await adminAuditService.log({
          adminUserId: result.admin.id,
          action: 'admin.auth.login',
          ip: req.ip,
          metadata: { email: result.admin.email },
        });
      } catch (auditErr) {
        this.logger.error(
          'Admin audit log failed after login',
          auditErr instanceof Error ? auditErr : new Error(String(auditErr))
        );
      }
      return sendSuccessResponse(res, result);
    } catch (e) {
      next(e);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body;
      const result = await this.adminAuthService.refresh(refreshToken);
      return sendSuccessResponse(res, result);
    } catch (e) {
      next(e);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body;
      await this.adminAuthService.logout(refreshToken);
      return sendSuccessResponse(res, { message: 'Logged out' });
    } catch (e) {
      next(e);
    }
  };
}
