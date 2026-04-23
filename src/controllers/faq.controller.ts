import { Request, Response } from 'express';
import { FaqService } from '../services/faq.service';
import { AppDataSource } from '../config/data-source';
import { createFaqSchema, updateFaqSchema } from '../validation/faq.dto';

export const FaqController = {
  async getAll(req: Request, res: Response) {
    try {
      const faqService = new FaqService(AppDataSource);
      const faqs = await faqService.getAll();
      return res.status(200).json({ success: true, response: faqs });
    } catch {
      return res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const faqService = new FaqService(AppDataSource);
      const faq = await faqService.getById(id);
      if (!faq) return res.status(404).json({ status: 'error', message: 'FAQ not found' });
      return res.status(200).json({ success: true, response: faq });
    } catch {
      return res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  },

  async getPublished(req: Request, res: Response) {
    try {
      const faqService = new FaqService(AppDataSource);
      const faqs = await faqService.getPublished();
      return res.status(200).json({ success: true, response: faqs });
    } catch {
      return res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const parsed = createFaqSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ status: 'error', errors: parsed.error.format() });
      }
      const faqService = new FaqService(AppDataSource);
      const faq = await faqService.create(parsed.data);
      return res.status(201).json({ success: true, response: faq });
    } catch {
      return res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const parsed = updateFaqSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ status: 'error', errors: parsed.error.format() });
      }
      const faqService = new FaqService(AppDataSource);
      const faq = await faqService.update(id, parsed.data);
      if (!faq) return res.status(404).json({ status: 'error', message: 'FAQ not found' });
      return res.status(200).json({ success: true, response: faq });
    } catch {
      return res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const faqService = new FaqService(AppDataSource);
      const success = await faqService.delete(id);
      if (!success) return res.status(404).json({ status: 'error', message: 'FAQ not found' });
      return res.status(200).json({ success: true, response: { message: 'FAQ deleted' } });
    } catch {
      return res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  },
};
