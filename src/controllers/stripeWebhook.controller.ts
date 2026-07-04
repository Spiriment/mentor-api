import { Request, Response } from 'express';
import { stripeService } from '@/services/stripe.service';
import { SubscriptionService, CANCEL_AT_PERIOD_END_NOTE } from '@/services/subscription.service';
import { EmailService } from '@/core/email.service';
import { familyPlanService } from '@/services/familyPlan.service';
import { AppDataSource } from '@/config/data-source';
import { User } from '@/database/entities/user.entity';
import { UserSubscription, SubscriptionTier } from '@/database/entities/userSubscription.entity';
import { logger } from '@/config/int-services';
import {
  inferBillingIntervalFromStripeInterval,
  stripePriceToMrrCents,
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

        let status: 'active' | 'past_due' | 'canceled' | 'trialing' = 'active';
        if (stripeSub.status === 'past_due') status = 'past_due';
        else if (stripeSub.status === 'canceled') status = 'canceled';
        else if (stripeSub.status === 'trialing') status = 'trialing';

        const cancelAtPeriodEnd = Boolean(stripeSub.cancel_at_period_end);
        const stripePrice = stripeSub.items?.data?.[0]?.price;
        const billingInterval = inferBillingIntervalFromStripeInterval(stripePrice?.recurring?.interval);
        const mrrCents = stripePriceToMrrCents(
          stripePrice?.unit_amount ?? 0,
          stripePrice?.recurring?.interval,
        );

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
            expiresAt: stripeSub.current_period_end
              ? new Date((stripeSub.current_period_end as number) * 1000)
              : null,
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

        const sub = await subRepo.findOne({ where: { user: { id: user.id } } });
        if (sub) {
          sub.status = 'past_due';
          await subRepo.save(sub);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as any;
        const subscriptionId: string | undefined =
          typeof invoice.subscription === 'string'
            ? invoice.subscription
            : invoice.subscription?.id;

        if (subscriptionId) {
          const familyMember = await familyPlanService.findMemberByStripeSubscriptionId(subscriptionId);
          if (familyMember) {
            const memberSub = await subRepo.findOne({ where: { user: { id: familyMember.userId } } });
            if (memberSub && memberSub.status === 'past_due') {
              memberSub.status = 'active';
              await subRepo.save(memberSub);
              break;
            }
          }

          const memberSub = await subRepo.findOne({ where: { externalRef: subscriptionId } });
          if (memberSub && memberSub.status === 'past_due') {
            memberSub.status = 'active';
            await subRepo.save(memberSub);
            break;
          }
        }

        const customerId: string | undefined =
          typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
        if (!customerId) break;

        const user = await userRepo.findOne({ where: { stripeCustomerId: customerId } });
        if (!user) break;

        const sub = await subRepo.findOne({ where: { user: { id: user.id } } });
        if (sub && sub.status === 'past_due') {
          sub.status = 'active';
          await subRepo.save(sub);
        }
        break;
      }

      default:
        break;
    }

    res.json({ received: true });
  } catch (err: any) {
    logger.error('Error processing Stripe webhook: ' + err.message, err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};
