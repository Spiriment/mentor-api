import { Request, Response } from 'express';
import { SubscriptionService, CANCEL_AT_PERIOD_END_NOTE } from '@/services/subscription.service';
import { EmailService } from '@/core/email.service';
import { webhookIdempotencyService } from '@/services/webhookIdempotency.service';
import { adminOrgPlanService } from '@/services/adminOrgPlan.service';
import { AppDataSource } from '@/config/data-source';
import { User } from '@/database/entities/user.entity';
import { SubscriptionTier } from '@/database/entities/userSubscription.entity';
import { logger } from '@/config/int-services';
import {
  inferBillingIntervalFromProductId,
  mrrCentsFromRcEvent,
} from '@/common/constants/subscriptionMrr';
import { resolveRevenueCatEventId } from '@/common/subscription/revenueCatEventId';

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

  const {
    type,
    app_user_id,
    product_id,
    expiration_at_ms,
    price,
    price_in_purchased_currency,
    transaction_id,
    original_transaction_id,
  } = event;

  if (!app_user_id) {
    res.status(400).json({ error: 'Missing app_user_id' });
    return;
  }

  const eventId = resolveRevenueCatEventId(event);
  logger.info('RevenueCat webhook received', { type, app_user_id, product_id, eventId });

  const claimed = await webhookIdempotencyService.tryClaim(eventId, 'revenuecat', String(type));
  if (!claimed) {
    res.json({ received: true });
    return;
  }

  const failWebhook = async (message: string, status = 500) => {
    await webhookIdempotencyService.releaseClaim(eventId);
    res.status(status).json({ error: message });
  };

  const userRepo = AppDataSource.getRepository(User);
  const user = await userRepo.findOne({ where: { id: app_user_id } });
  if (!user) {
    logger.warn('RevenueCat webhook: user not found, will retry', { app_user_id, eventId, type });
    await failWebhook('User not found — will retry');
    return;
  }

  const rcExternalRef =
    (transaction_id ? String(transaction_id) : null) ??
    (original_transaction_id ? String(original_transaction_id) : null) ??
    product_id ??
    null;

  try {
    switch (type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'PRODUCT_CHANGE': {
        const tier = tierFromProductId(product_id);
        if (!tier) {
          logger.warn('RevenueCat webhook: unknown product, will retry', {
            eventId,
            product_id,
          });
          await failWebhook('Unknown product — will retry');
          return;
        }
        await subscriptionService.upsertSubscription(user.id, {
          tier,
          status: 'active',
          externalProvider: 'revenuecat',
          externalRef: rcExternalRef,
          mrrCents: mrrCentsFromRcEvent({ product_id, price, price_in_purchased_currency }),
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

        if (!tier) {
          logger.warn('RevenueCat webhook: CANCELLATION with unknown tier', { eventId, product_id });
          await failWebhook('Unknown product — will retry');
          return;
        }

        await subscriptionService.upsertSubscription(user.id, {
          tier,
          status: 'active',
          externalProvider: 'revenuecat',
          externalRef: rcExternalRef ?? current.externalRef,
          mrrCents: product_id
            ? mrrCentsFromRcEvent({ product_id, price, price_in_purchased_currency })
            : undefined,
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
        const applied = await subscriptionService.upsertSubscription(user.id, {
          tier: 'free',
          status: 'active',
          externalProvider: null,
          externalRef: null,
          mrrCents: null,
          expiresAt: null,
          notes: null,
        });
        if (applied) {
          await adminOrgPlanService.releaseChurchMembership(user.id);
        }
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

    res.json({ received: true });
  } catch (err: any) {
    await webhookIdempotencyService.releaseClaim(eventId);
    logger.error('RevenueCat webhook processing error', err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ error: 'Processing failed' });
  }
};
