import { Request, Response } from 'express';
import { adminSearchService } from '@/services/adminSearch.service';

export class AdminSearchController {
  async globalSearch(req: Request, res: Response) {
    const { q } = req.query;
    if (typeof q !== 'string') {
      return res.json({ users: [], mentors: [], applications: [] });
    }

    const results = await adminSearchService.globalSearch(q);
    return res.json(results);
  }
}

export const adminSearchController = new AdminSearchController();
