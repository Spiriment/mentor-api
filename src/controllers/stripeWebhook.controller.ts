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
import { adminAlertService } from '@/services/adminAlert.service';
import {
  inferBillingIntervalFromStripeInterval,
  mrrCentsFromStripeInvoice,
  mrrCentsFromStripeSubscription,
  mrrCentsFromCatalogTier,
} from '@/common/constants/subscriptionMrr';
import {
  extractStripeCustomerId,
  extractStripeSubscriptionId,
  resolvePaymentFailedTarget,
} from '@/common/subscription/stripePaymentFailedResolver';

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

function resolveStripeMrrCents(
  stripeSub: Parameters<typeof mrrCentsFromStripeSubscription>[0],
  tier: SubscriptionTier,
  billingInterval: 'monthly' | 'annual',
): number {
  const fromStripe = mrrCentsFromStripeSubscription(stripeSub);
  if (fromStripe != null) return fromStripe;
  if (tier === 'basic' || tier === 'pro' || tier === 'premium') {
    return mrrCentsFromCatalogTier(tier, billingInterval);
  }
  return 0;
}

/**
 * Central church invoices (one-off, sent to the church's billing email). Their customer is
 * found by email and can be an app user's own Stripe customer, so without this check a failed
 * church payment would mark that person's personal subscription past due.
 */
function isChurchInvoice(invoice: any): boolean {
  return invoice?.metadata?.planType === 'church' && !!invoice?.metadata?.orgPlanId;
}

async function releaseChurchMembershipIfNeeded(userId: string): Promise<void> {
  try {
    await adminOrgPlanService.releaseChurchMembership(userId);
  } catch (err) {
    logger.warn('Failed to release church membership', {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function syncFamilyMemberFromStripeWebhook(params: {
  stripeSub: {
    id: string;
    metadata?: {
      familyPlanId?: string;
      familyMemberAgeDiscount?: string;
      familyMemberUserId?: string;
    };
  };
  memberUserId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  billingInterval: 'monthly' | 'annual';
  mrrCents: number;
  expiresAt: Date | null;
  sendActivationEmail: boolean;
}): Promise<void> {
  const { stripeSub, memberUserId, tier, status } = params;

  if (status === 'canceled') {
    await familyPlanService.syncMemberSubscription(memberUserId, stripeSub.id, 'canceled');
    return;
  }

  const planId = stripeSub.metadata?.familyPlanId;
  const existingMember = await familyPlanService.findActiveMemberByUserId(memberUserId);

  if (!planId && !existingMember) {
    throw new Error(
      `Family subscription ${stripeSub.id} has no familyPlanId metadata and no member record for user ${memberUserId}`,
    );
  }

  if (planId) {
    await familyPlanService.ensureMemberFromCheckout({
      planId,
      memberUserId,
      tier,
      ageDiscountPercent:
        parseInt(stripeSub.metadata?.familyMemberAgeDiscount ?? '0', 10) || 0,
    });
  }

  await familyPlanService.syncMemberSubscription(
    memberUserId,
    stripeSub.id,
    status,
    {
      sendActivationEmail: params.sendActivationEmail,
      tier,
      ...optionalMrr(params.mrrCents),
      billingInterval: params.billingInterval,
      expiresAt: params.expiresAt,
    },
  );
}

/** Fire-and-forget admin alert (never delays or fails the webhook response). */
function alertSubscriptionEvent(title: string, userId: string, detail: string) {
  void (async () => {
    const user = await AppDataSource.getRepository(User).findOne({
      where: { id: userId },
      select: ['id', 'firstName', 'lastName', 'email'],
    });
    const who = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'A user';
    await adminAlertService.notify('subscription', {
      title,
      body: `${who} · ${detail}`,
      link: '/subscriptions',
    });
  })().catch((err) => logger.error('Stripe admin alert failed', err));
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

  const claimed = await webhookIdempotencyService.tryClaim(event.id, 'stripe', event.type);
  if (!claimed) {
    res.json({ received: true });
    return;
  }

  const failWebhook = async (message: string, status = 500) => {
    await webhookIdempotencyService.releaseClaim(event.id);
    res.status(status).json({ error: message });
  };

  const subRepo = AppDataSource.getRepository(UserSubscription);
  const userRepo = AppDataSource.getRepository(User);

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
          await failWebhook('Missing userId — will retry');
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
              externalProvider: 'stripe',
              mrrCents: null,
              expiresAt: null,
            });
            await releaseChurchMembershipIfNeeded(userId);
          }
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
          await failWebhook('Unknown price — will retry');
          return;
        }

        const status = mapStripeSubscriptionStatus(stripeSub.status);
        if (!status) {
          logger.info('Stripe webhook: acknowledging terminal/unhandled subscription status', {
            eventId: event.id,
            stripeStatus: stripeSub.status,
            subscriptionId: stripeSub.id,
          });
          break;
        }

        const cancelAtPeriodEnd = Boolean(stripeSub.cancel_at_period_end);
        const stripePrice = stripeSub.items?.data?.[0]?.price;
        const billingInterval = inferBillingIntervalFromStripeInterval(stripePrice?.recurring?.interval);
        const mrrCents = resolveStripeMrrCents(stripeSub, tier, billingInterval);
        const expiresAt = stripeSub.current_period_end
          ? new Date((stripeSub.current_period_end as number) * 1000)
          : null;

        if (memberUserId) {
          try {
            await syncFamilyMemberFromStripeWebhook({
              stripeSub,
              memberUserId,
              tier,
              status,
              billingInterval,
              mrrCents,
              expiresAt,
              sendActivationEmail: event.type === 'customer.subscription.created',
            });
          } catch (err) {
            logger.warn('Stripe webhook: family member sync failed', {
              eventId: event.id,
              memberUserId,
              subscriptionId: stripeSub.id,
              error: err instanceof Error ? err.message : String(err),
            });
            await failWebhook('Family member sync failed — will retry');
            return;
          }
        } else {
          const orgPlanId = stripeSub.metadata?.orgPlanId;
          if (orgPlanId && status !== 'canceled') {
            await adminOrgPlanService.ensureChurchMemberAssignment(userId, orgPlanId);
          }

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

          if (event.type === 'customer.subscription.created' && status === 'active') {
            alertSubscriptionEvent('New subscription', userId, `${tier ?? 'unknown plan'} (Stripe)`);
          }
        }

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
          await failWebhook('Missing userId — will retry');
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
            externalProvider: 'stripe',
            mrrCents: null,
            expiresAt: null,
          });
          await releaseChurchMembershipIfNeeded(userId);
          alertSubscriptionEvent('Subscription ended', userId, 'Stripe');
        }

        break;
      }

      case 'invoice.paid':
      case 'invoice.overdue':
      case 'invoice.voided':
      case 'invoice.marked_uncollectible': {
        // Only central church invoices use these; personal subscriptions are handled above/below
        const invoice = event.data.object as any;
        if (isChurchInvoice(invoice)) {
          await adminOrgPlanService.recordChurchInvoiceFromStripe(invoice, event.type);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;
        if (isChurchInvoice(invoice)) {
          await adminOrgPlanService.recordChurchInvoiceFromStripe(invoice, event.type);
          break;
        }
        const subscriptionId = extractStripeSubscriptionId(invoice);
        const customerId = extractStripeCustomerId(invoice);

        let familyMemberUserId: string | null = null;
        if (subscriptionId) {
          const familyMember =
            await familyPlanService.findMemberByStripeSubscriptionId(subscriptionId);
          familyMemberUserId = familyMember?.userId ?? null;
        }

        let externalRefUserId: string | null = null;
        if (subscriptionId && !familyMemberUserId) {
          const memberSub = await subRepo.findOne({ where: { externalRef: subscriptionId } });
          externalRefUserId = memberSub?.userId ?? null;
        }

        let customerUserId: string | null = null;
        if (customerId) {
          const user = await userRepo.findOne({ where: { stripeCustomerId: customerId } });
          customerUserId = user?.id ?? null;
        }

        const resolution = resolvePaymentFailedTarget({
          subscriptionId,
          familyMemberUserId,
          externalRefUserId,
          customerId,
          customerUserId,
        });

        if (resolution.kind === 'user') {
          await subscriptionService.markPastDue(resolution.userId);
          alertSubscriptionEvent('Subscription payment failed', resolution.userId, 'Stripe');
        } else {
          logger.warn('invoice.payment_failed could not resolve user', {
            subscriptionId,
            customerId,
            reason: resolution.reason,
          });
        }

        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as any;
        if (isChurchInvoice(invoice)) {
          await adminOrgPlanService.recordChurchInvoiceFromStripe(invoice, event.type);
          break;
        }
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
            break;
          }

          const memberSub = await subRepo.findOne({ where: { externalRef: subscriptionId } });
          if (memberSub?.userId) {
            await subscriptionService.reactivateFromSuccessfulPayment(memberSub.userId, {
              mrrCents,
              externalRef: subscriptionId,
            });
            break;
          }
        }

        const customerId: string | undefined =
          typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
        if (!customerId) {
          break;
        }

        const user = await userRepo.findOne({ where: { stripeCustomerId: customerId } });
        if (!user) {
          break;
        }

        await subscriptionService.reactivateFromSuccessfulPayment(user.id, {
          mrrCents,
          externalRef: subscriptionId ?? undefined,
        });
        break;
      }

      default:
        break;
    }

    res.json({ received: true });
  } catch (err: any) {
    await webhookIdempotencyService.releaseClaim(event.id);
    logger.error('Error processing Stripe webhook: ' + err.message, err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};
