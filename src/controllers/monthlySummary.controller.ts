import { Request, Response, NextFunction } from 'express';
import { MonthlySummaryService } from '../services/monthlySummary.service';
import { sendSuccessResponse } from '@/common/helpers';
import { logger } from '@/config/int-services';

export class MonthlySummaryController {
  private monthlySummaryService: MonthlySummaryService;

  constructor() {
    this.monthlySummaryService = new MonthlySummaryService();
  }

  /**
   * Get monthly summary for a user
   * GET /api/reports/monthly/:year/:month
   */
  getMonthlySummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user; // Set by auth middleware

      if (!user) {
        return res.status(401).json({
          success: false,
          error: {
            message: 'User not authenticated',
            code: 'UNAUTHORIZED',
          },
        });
      }

      const year = parseInt(req.params.year);
      const month = parseInt(req.params.month);

      if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Invalid year or month parameter',
            code: 'INVALID_PARAMS',
          },
        });
      }

      logger.info('Getting monthly summary', {
        userId: user.id,
        year,
        month,
      });

      const summary = await this.monthlySummaryService.getMonthlySummary(
        user.id,
        year,
        month
      );

      return sendSuccessResponse(res, summary);
    } catch (error: any) {
      logger.error('Error getting monthly summary', error);
      next(error);
    }
  };

  /**
   * Manually trigger summary generation (e.g. for testing)
   * POST /api/reports/monthly/generate/:year/:month
   */
  generateSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({
          success: false,
          error: {
            message: 'User not authenticated',
            code: 'UNAUTHORIZED',
          },
        });
      }

      const year = parseInt(req.params.year);
      const month = parseInt(req.params.month);

      if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Invalid year or month parameter',
            code: 'INVALID_PARAMS',
          },
        });
      }

      const summary = await this.monthlySummaryService.generateMonthlySummary(
        user.id,
        year,
        month
      );

      return sendSuccessResponse(res, {
        summary,
        message: 'Monthly summary generated successfully',
      });
    } catch (error: any) {
      logger.error('Error generating monthly summary', error);
      next(error);
    }
  };
}
