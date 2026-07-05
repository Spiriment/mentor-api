import { Request, Response } from 'express';
import { SubscriptionService, CANCEL_AT_PERIOD_END_NOTE } from '@/services/subscription.service';
import { EmailService } from '@/core/email.service';
import { webhookIdempotencyService } from '@/services/webhookIdempotency.service';
import { AppDataSource } from '@/config/data-source';
import { User } from '@/database/entities/user.entity';
import { SubscriptionTier } from '@/database/entities/userSubscription.entity';
import { logger } from '@/config/int-services';
import {
  inferBillingIntervalFromProductId,
  mrrCentsFromRcProduct,
} from '@/common/constants/subscriptionMrr';

const emailService = new EmailService(null);
const subscriptionService = new SubscriptionService(emailService);

const PRODUCT_TIER_MAP: Record<string, SubscriptionTier> = {
  'com.spiriment.mentor.basic.monthly': 'basic',
  'com.spiriment.mentor.pro.monthly': 'pro',
  'com.spiriment.mentor.premium.monthly': 'premium',
  'com.spiriment.mentor.basic.annual': 'basic',
  'com.spiriment.mentor.pro.annual': 'pro',
  'com.spiriment.mentor.premium.annual': 'premium',
};

function tierFromProductId(productId: string): SubscriptionTier | null {
  if (!productId) return null;
  const tier = PRODUCT_TIER_MAP[productId];
  if (!tier) {
    logger.warn('RevenueCat webhook: unknown product ID', { productId });
    return null;
  }
  return tier;
}

function isWebhookAuthorized(authHeader: string | undefined, secret: string): boolean {
  if (!authHeader) return false;
  if (authHeader === secret) return true;
  if (authHeader === `Bearer ${secret}`) return true;
  return false;
}

export const handleRevenueCatWebhook = async (req: Request, res: Response): Promise<void> => {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('REVENUECAT_WEBHOOK_SECRET is not configured');
      res.status(503).json({ error: 'Webhook not configured' });
      return;
    }
    logger.warn('REVENUECAT_WEBHOOK_SECRET not set — accepting webhooks without auth (development only)');
  } else {
    const authHeader = req.headers['authorization'];
    if (!isWebhookAuthorized(authHeader, secret)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }

  const event = req.body?.event;
  if (!event) {
    res.status(400).json({ error: 'Missing event' });
    return;
  }

  const { type, app_user_id, product_id, expiration_at_ms, id: eventId } = event;
  logger.info('RevenueCat webhook received', { type, app_user_id, product_id });

  if (eventId && (await webhookIdempotencyService.isProcessed(String(eventId)))) {
    res.json({ received: true });
    return;
  }

  const userRepo = AppDataSource.getRepository(User);
  const user = await userRepo.findOne({ where: { id: app_user_id } });
  if (!user) {
    // User not found — still return 200 so RevenueCat doesn't retry
    logger.warn('RevenueCat webhook: user not found', { app_user_id });
    res.json({ received: true });
    return;
  }

  try {
    switch (type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'PRODUCT_CHANGE': {
        const tier = tierFromProductId(product_id);
        if (!tier) break;
        await subscriptionService.upsertSubscription(user.id, {
          tier,
          status: 'active',
          externalProvider: 'revenuecat',
          externalRef: product_id,
          mrrCents: mrrCentsFromRcProduct(product_id),
          billingInterval: inferBillingIntervalFromProductId(product_id),
          expiresAt: expiration_at_ms ? new Date(expiration_at_ms) : null,
        });
        break;
      }

      case 'CANCELLATION': {
        const current = await subscriptionService.getSubscriptionForUser(user.id);
        const tier =
          current.tier !== 'none' && current.tier !== 'free'
            ? (current.tier as SubscriptionTier)
            : tierFromProductId(product_id);

        if (!tier) break;

        await subscriptionService.upsertSubscription(user.id, {
          tier,
          status: 'active',
          externalProvider: 'revenuecat',
          externalRef: product_id ?? current.externalRef,
          mrrCents: product_id ? mrrCentsFromRcProduct(product_id) : undefined,
          billingInterval: product_id ? inferBillingIntervalFromProductId(product_id) : undefined,
          expiresAt: expiration_at_ms
            ? new Date(expiration_at_ms)
            : current.expiresAt
              ? new Date(current.expiresAt as string | Date)
              : null,
          notes: CANCEL_AT_PERIOD_END_NOTE,
        });
        break;
      }

      case 'EXPIRATION': {
        await subscriptionService.upsertSubscription(user.id, {
          tier: 'free',
          status: 'active',
          externalProvider: null,
          externalRef: null,
          mrrCents: 0,
          expiresAt: null,
          notes: null,
        });
        break;
      }

      case 'BILLING_ISSUE': {
        const sub = await subscriptionService.getSubscriptionForUser(user.id);
        if (sub.status === 'active') {
          await subscriptionService.upsertSubscription(user.id, {
            tier: sub.tier as SubscriptionTier,
            status: 'past_due',
            externalProvider: 'revenuecat',
          });
        }
        break;
      }

      default:
        break;
    }

    if (eventId) {
      await webhookIdempotencyService.markProcessed(String(eventId), 'revenuecat', type);
    }
    res.json({ received: true });
  } catch (err: any) {
    logger.error('RevenueCat webhook processing error', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ error: 'Processing failed' });
  }
};
