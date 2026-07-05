import { AppDataSource } from '@/config/data-source';
import { ProcessedWebhookEvent } from '@/database/entities/processedWebhookEvent.entity';

export class WebhookIdempotencyService {
  private get repo() {
    return AppDataSource.getRepository(ProcessedWebhookEvent);
  }

  async isProcessed(eventId: string): Promise<boolean> {
    if (!eventId) return false;
    const existing = await this.repo.findOne({ where: { id: eventId } });
    return !!existing;
  }

  async markProcessed(
    eventId: string,
    provider: string,
    eventType: string,
  ): Promise<void> {
    if (!eventId) return;
    try {
      await this.repo.save(
        this.repo.create({ id: eventId, provider, eventType }),
      );
    } catch {
      // Concurrent duplicate delivery — safe to ignore
    }
  }
}

export const webhookIdempotencyService = new WebhookIdempotencyService();
