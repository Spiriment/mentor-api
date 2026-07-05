import { Request, Response } from 'express';
import { stripeService } from '@/services/stripe.service';
import { SubscriptionService, CANCEL_AT_PERIOD_END_NOTE } from '@/services/subscription.service';
import { EmailService } from '@/core/email.service';
import { familyPlanService } from '@/services/familyPlan.service';
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

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const stripeSub = event.data.object as any;
        const userId: string | undefined = stripeSub.metadata?.userId;
        if (!userId) break;

        const memberUserId = await resolveFamilyMemberUserId(stripeSub);
        const priceId: string = stripeSub.items?.data?.[0]?.price?.id ?? '';
        const tier = tierFromPriceId(priceId);
        if (!tier) break;

        const status = mapStripeSubscriptionStatus(stripeSub.status);
        if (!status) break;

        const cancelAtPeriodEnd = Boolean(stripeSub.cancel_at_period_end);
        const stripePrice = stripeSub.items?.data?.[0]?.price;
        const billingInterval = inferBillingIntervalFromStripeInterval(stripePrice?.recurring?.interval);
        const mrrCents = mrrCentsFromStripeSubscription(stripeSub) ?? 0;
        const expiresAt = stripeSub.current_period_end
          ? new Date((stripeSub.current_period_end as number) * 1000)
          : null;

        if (memberUserId) {
          if (status !== 'canceled') {
            const planId = stripeSub.metadata?.familyPlanId;
            if (planId) {
              try {
                await familyPlanService.ensureMemberFromCheckout({
                  planId,
                  memberUserId,
                  tier,
                  ageDiscountPercent:
                    parseInt(stripeSub.metadata?.familyMemberAgeDiscount ?? '0', 10) || 0,
                });
              } catch (err: any) {
                logger.error(
                  `Family member checkout activation failed: memberUserId=${memberUserId} planId=${planId}`,
                  err instanceof Error ? err : new Error(String(err)),
                );
              }
            }
          }

          await familyPlanService.syncMemberSubscription(
            memberUserId,
            stripeSub.id,
            status,
            {
              sendActivationEmail: event.type === 'customer.subscription.created',
              tier,
              mrrCents,
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
            mrrCents,
            billingInterval,
            expiresAt,
            notes: cancelAtPeriodEnd ? CANCEL_AT_PERIOD_END_NOTE : undefined,
          });

          const promoCodeId = stripeSub.metadata?.promoCodeId;
          if (promoCodeId && event.type === 'customer.subscription.created') {
            await subscriptionService.completePromoRedemption(userId, promoCodeId);
          }
        }

        break;
      }

      case 'customer.subscription.deleted': {
        const stripeSub = event.data.object as any;
        const userId: string | undefined = stripeSub.metadata?.userId;
        if (!userId) break;

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
            break;
          }

          const memberSub = await subRepo.findOne({ where: { externalRef: subscriptionId } });
          if (memberSub?.userId) {
            await subscriptionService.markPastDue(memberSub.userId);
            break;
          }
        }

        const customerId: string | undefined =
          typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
        if (!customerId) break;

        const user = await userRepo.findOne({ where: { stripeCustomerId: customerId } });
        if (!user) break;

        await subscriptionService.markPastDue(user.id);
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
              { mrrCents: mrrCents ?? undefined },
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
        if (!customerId) break;

        const user = await userRepo.findOne({ where: { stripeCustomerId: customerId } });
        if (!user) break;

        await subscriptionService.reactivateFromSuccessfulPayment(user.id, {
          mrrCents,
          externalRef: subscriptionId ?? undefined,
        });
        break;
      }

      default:
        break;
    }

    await webhookIdempotencyService.markProcessed(event.id, 'stripe', event.type);
    res.json({ received: true });
  } catch (err: any) {
    logger.error('Error processing Stripe webhook: ' + err.message, err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};
