import { AppDataSource } from '@/config/data-source';
import { ProcessedWebhookEvent } from '@/database/entities/processedWebhookEvent.entity';

function isDuplicateKeyError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: string; errno?: number }).code;
  const errno = (err as { errno?: number }).errno;
  return code === 'ER_DUP_ENTRY' || code === '23505' || errno === 1062;
}

export class WebhookIdempotencyService {
  private get repo() {
    return AppDataSource.getRepository(ProcessedWebhookEvent);
  }

  /** @deprecated Prefer tryClaim — check-then-act can race under concurrent delivery. */
  async isProcessed(eventId: string): Promise<boolean> {
    if (!eventId) return false;
    const existing = await this.repo.findOne({ where: { id: eventId } });
    return !!existing;
  }

  /**
   * Insert-first claim. Returns true if this delivery should process the event.
   * Returns false if another delivery already claimed it.
   */
  async tryClaim(eventId: string, provider: string, eventType: string): Promise<boolean> {
    if (!eventId) return true;
    try {
      await this.repo.insert({ id: eventId, provider, eventType });
      return true;
    } catch (err) {
      if (isDuplicateKeyError(err)) return false;
      throw err;
    }
  }

  /** Release a claim so Stripe/RC can retry after a processing failure. */
  async releaseClaim(eventId: string): Promise<void> {
    if (!eventId) return;
    await this.repo.delete({ id: eventId });
  }

  /** @deprecated Prefer tryClaim at the start of processing. */
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
