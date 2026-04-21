import { Request, Response } from 'express';
import { ContactService } from '../services/contact.service';
import { AppDataSource } from '../config/data-source';
import { contactValidationSchema } from '../validation/contact.dto';
import { EmailService } from '../core/email.service';

export const ContactController = {
  async createMessage(req: Request, res: Response) {
    try {
      const parsedData = contactValidationSchema.safeParse(req.body);
      if (!parsedData.success) {
        return res.status(400).json({
          status: 'error',
          message: 'Validation failed',
          errors: parsedData.error.format(),
        });
      }

      // Initialize properly
      const emailService = new EmailService(null);
      const contactService = new ContactService(AppDataSource, emailService);

      const message = await contactService.createMessage(parsedData.data);

      return res.status(201).json({
        success: true,
        response: message,
      });
    } catch (error) {
      console.error('Error creating contact message:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Internal server error',
      });
    }
  },

  async getAllMessages(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const contactService = new ContactService(AppDataSource);
      const data = await contactService.getAllMessages(page, limit);

      return res.status(200).json({
        success: true,
        response: {
          data: data.messages,
          pagination: {
            total: data.total,
            page,
            limit,
          },
        },
      });
    } catch (error) {
      console.error('Error fetching contact messages:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Internal server error',
      });
    }
  }
};
