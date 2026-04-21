import { DataSource, Repository } from 'typeorm';
import { ContactMessage } from '../database/entities/contactMessage.entity';
import { ContactDTO } from '../validation/contact.dto';
import { EmailService } from '../core/email.service';
import { logger } from '../config/int-services';

export class ContactService {
  private contactRepo: Repository<ContactMessage>;

  constructor(
    private readonly dataSource: DataSource,
    private readonly emailService?: EmailService
  ) {
    this.contactRepo = this.dataSource.getRepository(ContactMessage);
  }

  async createMessage(data: ContactDTO): Promise<ContactMessage> {
    const newMessage = this.contactRepo.create(data);
    const savedMessage = await this.contactRepo.save(newMessage);

    // Optionally notify admin (fire and forget)
    if (this.emailService) {
      this.emailService.sendNotificationEmail({
        to: 'admin@spiriment.com',
        subject: `New ${data.type} Inquiry from ${data.name}`,
        message: `You have received a new inquiry.\n\nName: ${data.name}\nEmail: ${data.email}\nPhone: ${data.phone || 'N/A'}\nMessage: ${data.message || 'N/A'}\nType: ${data.type}`,
        userName: 'Admin',
      }).catch(error => {
        logger.error('Failed to send contact notification email', error);
      });
    }

    return savedMessage;
  }

  async getAllMessages(page = 1, limit = 20): Promise<{ messages: ContactMessage[], total: number }> {
    const [messages, total] = await this.contactRepo.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return { messages, total };
  }
}
