import { Request, Response, NextFunction } from 'express';
import { sendSuccessResponse } from '@/common/helpers';
import { adminBroadcastService } from '@/services/adminBroadcast.service';
import { FileUploadService } from '@/core/fileUpload.service';
import fs from 'fs';

export class AdminBroadcastController {
  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query as Record<string, string | undefined>;
      const result = await adminBroadcastService.listCampaigns({
        page: q.page ? Number(q.page) : undefined,
        limit: q.limit ? Number(q.limit) : undefined,
        status: q.status as any,
        templatesOnly: q.templatesOnly === 'true',
      });
      return sendSuccessResponse(res, result);
    } catch (e) {
      next(e);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const campaign = await adminBroadcastService.getCampaign(req.params.id);
      return sendSuccessResponse(res, campaign);
    } catch (e) {
      next(e);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const campaign = await adminBroadcastService.createCampaign(
        req.body,
        req.admin!.id
      );
      return sendSuccessResponse(res, campaign, 201);
    } catch (e) {
      next(e);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const campaign = await adminBroadcastService.updateCampaign(
        req.params.id,
        req.body,
        req.admin!.id
      );
      return sendSuccessResponse(res, campaign);
    } catch (e) {
      next(e);
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await adminBroadcastService.deleteCampaign(
        req.params.id,
        req.admin!.id
      );
      return sendSuccessResponse(res, result);
    } catch (e) {
      next(e);
    }
  };

  previewAudience = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const preview = await adminBroadcastService.previewAudience(req.params.id);
      return sendSuccessResponse(res, preview);
    } catch (e) {
      next(e);
    }
  };

  importExcel = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: { message: 'Excel file is required' },
        });
      }

      const result = await adminBroadcastService.importExcel(
        req.params.id,
        req.file.path,
        req.admin!.id
      );

      setTimeout(() => {
        try {
          if (fs.existsSync(req.file!.path)) fs.unlinkSync(req.file!.path);
        } catch {}
      }, 5000);

      return sendSuccessResponse(res, result);
    } catch (e) {
      next(e);
    }
  };

  sendTest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await adminBroadcastService.sendTestEmail(
        req.params.id,
        req.body.email,
        req.admin!.id
      );
      return sendSuccessResponse(res, result);
    } catch (e) {
      next(e);
    }
  };

  send = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await adminBroadcastService.sendCampaign(
        req.params.id,
        req.admin!.id,
        req.ip
      );
      return sendSuccessResponse(res, result, 202);
    } catch (e) {
      next(e);
    }
  };

  schedule = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const campaign = await adminBroadcastService.scheduleCampaign(
        req.params.id,
        req.body.scheduledAt,
        req.admin!.id,
        req.ip
      );
      return sendSuccessResponse(res, campaign);
    } catch (e) {
      next(e);
    }
  };

  cancel = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const campaign = await adminBroadcastService.cancelCampaign(
        req.params.id,
        req.admin!.id,
        req.ip
      );
      return sendSuccessResponse(res, campaign);
    } catch (e) {
      next(e);
    }
  };

  duplicate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const campaign = await adminBroadcastService.duplicateCampaign(
        req.params.id,
        req.admin!.id
      );
      return sendSuccessResponse(res, campaign, 201);
    } catch (e) {
      next(e);
    }
  };

  saveAsTemplate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const template = await adminBroadcastService.saveAsTemplate(
        req.params.id,
        req.body.templateName,
        req.admin!.id
      );
      return sendSuccessResponse(res, template, 201);
    } catch (e) {
      next(e);
    }
  };

  listRecipients = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query as Record<string, string | undefined>;
      const result = await adminBroadcastService.listRecipients(req.params.id, {
        page: q.page ? Number(q.page) : undefined,
        limit: q.limit ? Number(q.limit) : undefined,
        status: q.status as any,
      });
      return sendSuccessResponse(res, result);
    } catch (e) {
      next(e);
    }
  };

  uploadImage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: { message: 'No image provided' },
        });
      }

      const fileUploadService = new FileUploadService();
      const result = await fileUploadService.uploadFile(req.file.path, {
        folder: 'mentor-app/broadcast',
      });

      return res.status(200).json({
        success: true,
        location: result.secure_url,
      });
    } catch (e) {
      next(e);
    }
  };
}

export const adminBroadcastController = new AdminBroadcastController();
