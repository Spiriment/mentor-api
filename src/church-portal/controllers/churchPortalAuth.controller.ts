import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ChurchPortalAuthService } from '../services/churchPortalAuth.service';
import {
  loginSchema,
  acceptInviteSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateProfileSchema,
  refreshTokenSchema,
} from '../validation/churchPortalAuth.validation';

export class ChurchPortalAuthController {
  constructor(private readonly authService: ChurchPortalAuthService) {}

  getPortalInfo = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { slug } = req.query as { slug: string };
      if (!slug) {
        res.status(StatusCodes.BAD_REQUEST).json({ status: 'error', message: 'slug is required' });
        return;
      }
      const portal = await this.authService.getPortalInfo(slug);
      res.status(StatusCodes.OK).json({ status: 'success', data: portal });
    } catch (err) {
      next(err);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = loginSchema.parse(req.body);
      const result = await this.authService.login(body.email, body.password, body.churchPortalId);
      res.status(StatusCodes.OK).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = refreshTokenSchema.parse(req.body);
      await this.authService.logout(body.refreshToken);
      res.status(StatusCodes.OK).json({ status: 'success', message: 'Logged out successfully' });
    } catch (err) {
      next(err);
    }
  };

  refreshToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = refreshTokenSchema.parse(req.body);
      const result = await this.authService.refreshToken(body.refreshToken);
      res.status(StatusCodes.OK).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  };

  acceptInvite = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = acceptInviteSchema.parse(req.body);
      const result = await this.authService.acceptInvite(body.inviteToken, body.password);
      res.status(StatusCodes.OK).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  };

  forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = forgotPasswordSchema.parse(req.body);
      const result = await this.authService.forgotPassword(body.email, body.churchPortalId);
      res.status(StatusCodes.OK).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = resetPasswordSchema.parse(req.body);
      const result = await this.authService.resetPassword(
        body.email,
        body.otp,
        body.newPassword,
        (req.body as any).churchPortalId
      );
      res.status(StatusCodes.OK).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  };

  getMe = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.getMe(req.churchPortalUser!.id);
      res.status(StatusCodes.OK).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  };

  updateMe = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = updateProfileSchema.parse(req.body);
      const result = await this.authService.updateMe(req.churchPortalUser!.id, body);
      res.status(StatusCodes.OK).json({ status: 'success', data: result });
    } catch (err) {
      next(err);
    }
  };
}
