import { Request, Response } from 'express';
import { stripeService } from '@/services/stripe.service';
import { SubscriptionService } from '@/services/subscription.service';
import { EmailService } from '@/core/email.service';
import { familyPlanService } from '@/services/familyPlan.service';
import { AppDataSource } from '@/config/data-source';
import { User } from '@/database/entities/user.entity';
import { UserSubscription, SubscriptionTier } from '@/database/entities/userSubscription.entity';
import { logger } from '@/config/int-services';

const emailService = new EmailService(null);
const subscriptionService = new SubscriptionService(emailService);

const PRICE_TIER_MAP: Record<string, SubscriptionTier> = {
  [process.env.STRIPE_PRICE_BASIC_MONTHLY ?? '']: 'basic',
  [process.env.STRIPE_PRICE_PRO_MONTHLY ?? '']: 'pro',
  [process.env.STRIPE_PRICE_PREMIUM_MONTHLY ?? '']: 'premium',
};

function tierFromPriceId(priceId: string): SubscriptionTier {
  return PRICE_TIER_MAP[priceId] ?? 'basic';
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
        const familyMemberUserId: string | undefined = stripeSub.metadata?.familyMemberUserId;
        if (!userId) break;

        const priceId: string = stripeSub.items?.data?.[0]?.price?.id ?? '';
        const tier = tierFromPriceId(priceId);

        let status: 'active' | 'past_due' | 'canceled' | 'trialing' = 'active';
        if (stripeSub.status === 'past_due') status = 'past_due';
        else if (stripeSub.status === 'canceled') status = 'canceled';
        else if (stripeSub.status === 'trialing') status = 'trialing';

        if (familyMemberUserId) {
          await familyPlanService.syncMemberSubscription(familyMemberUserId, stripeSub.id, status);
        } else {
          await subscriptionService.upsertSubscription(userId, {
            tier,
            status,
            externalRef: stripeSub.id,
            externalProvider: 'stripe',
            mrrCents: stripeSub.items?.data?.[0]?.price?.unit_amount ?? 0,
            expiresAt: stripeSub.current_period_end
              ? new Date((stripeSub.current_period_end as number) * 1000)
              : null,
          });
        }

        break;
      }

      case 'customer.subscription.deleted': {
        const stripeSub = event.data.object as any;
        const userId: string | undefined = stripeSub.metadata?.userId;
        if (!userId) break;

        await subscriptionService.upsertSubscription(userId, {
          tier: 'free',
          status: 'active',
          externalRef: null,
          externalProvider: null,
          mrrCents: 0,
          expiresAt: null,
        });
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;
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
