import { Request, Response, NextFunction } from 'express';
import { sendSuccessResponse } from '@/common/helpers';
import { adminQuizService } from '@/services/adminQuiz.service';

export class AdminQuizController {
  catalog = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await adminQuizService.getQuizStats();
      return sendSuccessResponse(res, result);
    } catch (e) {
      next(e);
    }
  };
}

export const adminQuizController = new AdminQuizController();
