import { Request, Response } from 'express';
import { stripeService } from '@/services/stripe.service';
import { SubscriptionService, CANCEL_AT_PERIOD_END_NOTE } from '@/services/subscription.service';
import { EmailService } from '@/core/email.service';
import { familyPlanService } from '@/services/familyPlan.service';
import { adminOrgPlanService } from '@/services/adminOrgPlan.service';
import { webhookIdempotencyService } from '@/services/webhookIdempotency.service';
import { AppDataSource } from '@/config/data-source';
import { User } from '@/database/entities/user.entity';
import { UserSubscription, SubscriptionTier, SubscriptionStatus } from '@/database/entities/userSubscription.entity';
import { logger } from '@/config/int-services';
import {
  inferBillingIntervalFromStripeInterval,
  mrrCentsFromStripeInvoice,
  mrrCentsFromStripeSubscription,
} from '@/common/constants/subscriptionMrr';

const emailService = new EmailService(null);
const subscriptionService = new SubscriptionService(emailService);

const PRICE_TIER_MAP: Record<string, SubscriptionTier> = {
  [process.env.STRIPE_PRICE_BASIC_MONTHLY ?? '']: 'basic',
  [process.env.STRIPE_PRICE_PRO_MONTHLY ?? '']: 'pro',
  [process.env.STRIPE_PRICE_PREMIUM_MONTHLY ?? '']: 'premium',
  [process.env.STRIPE_PRICE_BASIC_ANNUAL ?? '']: 'basic',
  [process.env.STRIPE_PRICE_PRO_ANNUAL ?? '']: 'pro',
  [process.env.STRIPE_PRICE_PREMIUM_ANNUAL ?? '']: 'premium',
};

function tierFromPriceId(priceId: string): SubscriptionTier | null {
  if (!priceId) return null;
  const tier = PRICE_TIER_MAP[priceId];
  if (!tier) {
    logger.warn('Stripe webhook: unknown price ID', { priceId });
    return null;
  }
  return tier;
}

const PAID_ACCESS_REVOKED_STRIPE_STATUSES = new Set([
  'incomplete',
  'incomplete_expired',
  'unpaid',
  'paused',
]);

function isPaidAccessRevokedStripeStatus(stripeStatus: string): boolean {
  return PAID_ACCESS_REVOKED_STRIPE_STATUSES.has(stripeStatus);
}

function mapStripeSubscriptionStatus(stripeStatus: string): SubscriptionStatus | null {
  switch (stripeStatus) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'past_due':
      return 'past_due';
    case 'canceled':
      return 'canceled';
    case 'incomplete':
    case 'incomplete_expired':
    case 'unpaid':
    case 'paused':
      return null;
    default:
      logger.warn('Stripe webhook: unhandled subscription status', { stripeStatus });
      return null;
  }
}

async function resolveFamilyMemberUserId(
  stripeSub: { id: string; metadata?: { familyMemberUserId?: string } },
): Promise<string | undefined> {
  if (stripeSub.metadata?.familyMemberUserId) {
    return stripeSub.metadata.familyMemberUserId;
  }
  const member = await familyPlanService.findMemberByStripeSubscriptionId(stripeSub.id);
  return member?.userId;
}

function optionalMrr(mrrCents: number | null): { mrrCents?: number } {
  return mrrCents != null ? { mrrCents } : {};
}

export const handleStripeWebhook = async (req: Request, res: Response): Promise<void> => {
  const sig = req.headers['stripe-signature'] as string;

  let event: ReturnType<typeof stripeService.constructWebhookEvent>;
  try {
    event = stripeService.constructWebhookEvent(req.body as Buffer, sig);
  } catch (err: any) {
    logger.warn('Stripe webhook signature verification failed: ' + err.message);
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }

  if (await webhookIdempotencyService.isProcessed(event.id)) {
    res.json({ received: true });
    return;
  }

  const subRepo = AppDataSource.getRepository(UserSubscription);
  const userRepo = AppDataSource.getRepository(User);
  let shouldMarkProcessed = false;

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const stripeSub = event.data.object as any;
        const userId: string | undefined = stripeSub.metadata?.userId;
        if (!userId) {
          logger.warn('Stripe webhook: missing userId in subscription metadata', {
            eventId: event.id,
            subscriptionId: stripeSub.id,
          });
          res.status(500).json({ error: 'Missing userId — will retry' });
          return;
        }

        const memberUserId = await resolveFamilyMemberUserId(stripeSub);

        if (isPaidAccessRevokedStripeStatus(stripeSub.status)) {
          if (memberUserId) {
            await familyPlanService.syncMemberSubscription(
              memberUserId,
              stripeSub.id,
              'canceled',
            );
          } else {
            await subscriptionService.upsertSubscription(userId, {
              tier: 'free',
              status: 'active',
              externalRef: null,
              externalProvider: null,
              mrrCents: 0,
              expiresAt: null,
            });
          }
          shouldMarkProcessed = true;
          break;
        }

        const priceId: string = stripeSub.items?.data?.[0]?.price?.id ?? '';
        const tier = tierFromPriceId(priceId);
        if (!tier) {
          logger.warn('Stripe webhook: could not resolve tier from price', {
            eventId: event.id,
            priceId,
            subscriptionId: stripeSub.id,
          });
          res.status(500).json({ error: 'Unknown price — will retry' });
          return;
        }

        const status = mapStripeSubscriptionStatus(stripeSub.status);
        if (!status) {
          logger.warn('Stripe webhook: skipping subscription with non-paid status', {
            eventId: event.id,
            stripeStatus: stripeSub.status,
            subscriptionId: stripeSub.id,
          });
          res.status(500).json({ error: 'Unhandled subscription status — will retry' });
          return;
        }

        const cancelAtPeriodEnd = Boolean(stripeSub.cancel_at_period_end);
        const stripePrice = stripeSub.items?.data?.[0]?.price;
        const billingInterval = inferBillingIntervalFromStripeInterval(stripePrice?.recurring?.interval);
        const mrrCents = mrrCentsFromStripeSubscription(stripeSub);
        const expiresAt = stripeSub.current_period_end
          ? new Date((stripeSub.current_period_end as number) * 1000)
          : null;

        if (memberUserId) {
          if (status !== 'canceled') {
            const planId = stripeSub.metadata?.familyPlanId;
            if (planId) {
              await familyPlanService.ensureMemberFromCheckout({
                planId,
                memberUserId,
                tier,
                ageDiscountPercent:
                  parseInt(stripeSub.metadata?.familyMemberAgeDiscount ?? '0', 10) || 0,
              });
            }
          }

          await familyPlanService.syncMemberSubscription(
            memberUserId,
            stripeSub.id,
            status,
            {
              sendActivationEmail: event.type === 'customer.subscription.created',
              tier,
              ...optionalMrr(mrrCents),
              billingInterval,
              expiresAt,
            },
          );
        } else {
          await subscriptionService.upsertSubscription(userId, {
            tier,
            status,
            externalRef: stripeSub.id,
            externalProvider: 'stripe',
            ...optionalMrr(mrrCents),
            billingInterval,
            expiresAt,
            notes: cancelAtPeriodEnd ? CANCEL_AT_PERIOD_END_NOTE : undefined,
          });

          const promoCodeId = stripeSub.metadata?.promoCodeId;
          if (promoCodeId && event.type === 'customer.subscription.created') {
            await subscriptionService.completePromoRedemption(userId, promoCodeId);
          }

          const orgPlanId = stripeSub.metadata?.orgPlanId;
          if (orgPlanId && event.type === 'customer.subscription.created') {
            await adminOrgPlanService.completeChurchMemberAssignment(userId, orgPlanId);
          }
        }

        shouldMarkProcessed = true;
        break;
      }

      case 'customer.subscription.deleted': {
        const stripeSub = event.data.object as any;
        const userId: string | undefined = stripeSub.metadata?.userId;
        if (!userId) {
          logger.warn('Stripe webhook: missing userId on subscription.deleted', {
            eventId: event.id,
            subscriptionId: stripeSub.id,
          });
          res.status(500).json({ error: 'Missing userId — will retry' });
          return;
        }

        const memberUserId = await resolveFamilyMemberUserId(stripeSub);
        if (memberUserId) {
          await familyPlanService.syncMemberSubscription(
            memberUserId,
            stripeSub.id,
            'canceled',
          );
        } else {
          await subscriptionService.upsertSubscription(userId, {
            tier: 'free',
            status: 'active',
            externalRef: null,
            externalProvider: null,
            mrrCents: 0,
            expiresAt: null,
          });
        }

        shouldMarkProcessed = true;
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;
        const subscriptionId: string | undefined =
          typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription?.id;

        if (subscriptionId) {
          const familyMember = await familyPlanService.findMemberByStripeSubscriptionId(subscriptionId);
          if (familyMember) {
            await subscriptionService.markPastDue(familyMember.userId);
            shouldMarkProcessed = true;
            break;
          }

          const memberSub = await subRepo.findOne({ where: { externalRef: subscriptionId } });
          if (memberSub?.userId) {
            await subscriptionService.markPastDue(memberSub.userId);
            shouldMarkProcessed = true;
            break;
          }
        }

        const customerId: string | undefined =
          typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
        if (!customerId) {
          shouldMarkProcessed = true;
          break;
        }

        const user = await userRepo.findOne({ where: { stripeCustomerId: customerId } });
        if (!user) {
          shouldMarkProcessed = true;
          break;
        }

        await subscriptionService.markPastDue(user.id);
        shouldMarkProcessed = true;
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as any;
        const mrrCents = mrrCentsFromStripeInvoice(invoice);
        const subscriptionId: string | undefined =
          typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription?.id;

        if (subscriptionId) {
          const familyMember = await familyPlanService.findMemberByStripeSubscriptionId(subscriptionId);
          if (familyMember) {
            await familyPlanService.syncMemberSubscription(
              familyMember.userId,
              subscriptionId,
              'active',
              optionalMrr(mrrCents),
            );
            shouldMarkProcessed = true;
            break;
          }

          const memberSub = await subRepo.findOne({ where: { externalRef: subscriptionId } });
          if (memberSub?.userId) {
            await subscriptionService.reactivateFromSuccessfulPayment(memberSub.userId, {
              mrrCents,
              externalRef: subscriptionId,
            });
            shouldMarkProcessed = true;
            break;
          }
        }

        const customerId: string | undefined =
          typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
        if (!customerId) {
          shouldMarkProcessed = true;
          break;
        }

        const user = await userRepo.findOne({ where: { stripeCustomerId: customerId } });
        if (!user) {
          shouldMarkProcessed = true;
          break;
        }

        await subscriptionService.reactivateFromSuccessfulPayment(user.id, {
          mrrCents,
          externalRef: subscriptionId ?? undefined,
        });
        shouldMarkProcessed = true;
        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object as { metadata?: { userId?: string; orgPlanId?: string } };
        const orgPlanId = session.metadata?.orgPlanId;
        const userId = session.metadata?.userId;
        if (orgPlanId && userId) {
          await adminOrgPlanService.releasePendingChurchCheckout(orgPlanId, userId);
          logger.info('Released pending church seat after expired checkout', { orgPlanId, userId });
        }
        shouldMarkProcessed = true;
        break;
      }

      default:
        shouldMarkProcessed = true;
        break;
    }

    if (shouldMarkProcessed) {
      await webhookIdempotencyService.markProcessed(event.id, 'stripe', event.type);
    }
    res.json({ received: true });
  } catch (err: any) {
    logger.error('Error processing Stripe webhook: ' + err.message, err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};
