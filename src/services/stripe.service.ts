import Stripe = require('stripe');
import { AppDataSource } from '@/config/data-source';
import { User } from '@/database/entities/user.entity';
import { AppError } from '@/common';

const TIER_PRICE_MAP: Record<string, string> = {
  basic:          process.env.STRIPE_PRICE_BASIC_MONTHLY  ?? '',
  pro:            process.env.STRIPE_PRICE_PRO_MONTHLY    ?? '',
  premium:        process.env.STRIPE_PRICE_PREMIUM_MONTHLY ?? '',
  basic_annual:   process.env.STRIPE_PRICE_BASIC_ANNUAL   ?? '',
  pro_annual:     process.env.STRIPE_PRICE_PRO_ANNUAL     ?? '',
  premium_annual: process.env.STRIPE_PRICE_PREMIUM_ANNUAL ?? '',
};

class StripeService {
  private client: InstanceType<typeof Stripe>;

  constructor() {
    this.client = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_placeholder', {
      apiVersion: '2026-04-22.dahlia',
    });
  }

  get stripe(): InstanceType<typeof Stripe> {
    return this.client;
  }

  async getOrCreateCustomer(user: User): Promise<string> {
    if (user.stripeCustomerId) return user.stripeCustomerId;

    const customer = await this.client.customers.create({
      email: user.email,
      name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || undefined,
      metadata: { userId: user.id },
    });

    await AppDataSource.getRepository(User).update(user.id, {
      stripeCustomerId: customer.id,
    });

    return customer.id;
  }

  async createCheckoutSession(params: {
    user: User;
    tier: 'basic' | 'pro' | 'premium';
    interval?: 'monthly' | 'annual';
    successUrl: string;
    cancelUrl: string;
    couponId?: string;
  }): Promise<string> {
    const priceKey = params.interval === 'annual' ? `${params.tier}_annual` : params.tier;
    const priceId = TIER_PRICE_MAP[priceKey];
    if (!priceId) {
      throw new AppError(`Price ID for tier "${params.tier}" is not configured`, 500);
    }

    const customerId = await this.getOrCreateCustomer(params.user);

    const session = await this.client.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      payment_method_options: {
        card: { request_three_d_secure: 'automatic' },
      },
      line_items: [{ price: priceId, quantity: 1 }],
      ...(params.couponId ? { discounts: [{ coupon: params.couponId }] } : {}),
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: { userId: params.user.id, tier: params.tier },
      subscription_data: {
        metadata: { userId: params.user.id, tier: params.tier },
      },
    });

    return session.url!;
  }

  async createBillingPortalSession(user: User, returnUrl: string): Promise<string> {
    const customerId = await this.getOrCreateCustomer(user);
    const session = await this.client.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return session.url;
  }

  async cancelSubscription(stripeSubscriptionId: string): Promise<void> {
    await this.client.subscriptions.cancel(stripeSubscriptionId);
  }

  async createPercentageCoupon(discountPercent: number, promoCode: string): Promise<string> {
    const coupon = await this.client.coupons.create({
      percent_off: discountPercent,
      duration: 'forever',
      name: `Promo: ${promoCode}`,
      metadata: { promoCode },
    });
    return coupon.id;
  }

  constructWebhookEvent(payload: Buffer, signature: string): any {
    const secret = process.env.STRIPE_WEBHOOK_SECRET ?? '';
    return this.client.webhooks.constructEvent(payload, signature, secret);
  }
}

export const stripeService = new StripeService();
