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
    subscriptionMetadata?: Record<string, string>;
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
      metadata: { userId: params.user.id, tier: params.tier, ...params.subscriptionMetadata },
      subscription_data: {
        metadata: { userId: params.user.id, tier: params.tier, ...params.subscriptionMetadata },
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

  async cancelSubscriptionAtPeriodEnd(stripeSubscriptionId: string): Promise<void> {
    await this.client.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
  }

  async getOrCreatePercentageCoupon(discountPercent: number, promoCode: string): Promise<string> {
    const id = this.normalizeCouponId(promoCode);

    try {
      const existing = await this.client.coupons.retrieve(id);
      if (existing.valid && existing.percent_off === discountPercent) {
        return existing.id;
      }
    } catch (err: any) {
      if (err?.code !== 'resource_missing') throw err;
    }

    const coupon = await this.client.coupons.create({
      id,
      percent_off: discountPercent,
      duration: 'forever',
      name: `Promo: ${promoCode}`,
      metadata: { promoCode },
    });
    return coupon.id;
  }

  /** @deprecated Use getOrCreatePercentageCoupon — kept as alias for callers */
  async createPercentageCoupon(discountPercent: number, promoCode: string): Promise<string> {
    return this.getOrCreatePercentageCoupon(discountPercent, promoCode);
  }

  /**
   * Create a one-off Stripe invoice, email it to the customer for payment.
   * Amounts are in cents (EUR).
   */
  async createAndSendInvoice(params: {
    email: string;
    name?: string | null;
    userId?: string | null;
    description: string;
    lineItems: Array<{ description: string; amountCents: number }>;
    metadata?: Record<string, string>;
    daysUntilDue?: number;
  }): Promise<{
    invoiceId: string;
    hostedInvoiceUrl: string | null;
    invoicePdf: string | null;
    status: string;
    totalCents: number;
  }> {
    const positiveItems = params.lineItems.filter((item) => item.amountCents > 0);
    if (positiveItems.length === 0) {
      throw new AppError('Invoice must include at least one positive line item', 400);
    }

    const customers = await this.client.customers.list({ email: params.email, limit: 1 });
    let customerId = customers.data[0]?.id;
    if (!customerId) {
      const created = await this.client.customers.create({
        email: params.email,
        name: params.name || undefined,
        metadata: {
          ...(params.userId ? { userId: params.userId } : {}),
          source: 'central_invoice',
        },
      });
      customerId = created.id;
    }

    for (const item of positiveItems) {
      await this.client.invoiceItems.create({
        customer: customerId,
        amount: item.amountCents,
        currency: 'eur',
        description: item.description,
      });
    }

    const invoice = await this.client.invoices.create({
      customer: customerId,
      collection_method: 'send_invoice',
      days_until_due: params.daysUntilDue ?? 14,
      description: params.description,
      metadata: params.metadata ?? {},
      auto_advance: true,
    });

    const finalized = await this.client.invoices.finalizeInvoice(invoice.id);
    const sent = await this.client.invoices.sendInvoice(finalized.id);

    return {
      invoiceId: sent.id,
      hostedInvoiceUrl: sent.hosted_invoice_url ?? null,
      invoicePdf: sent.invoice_pdf ?? null,
      status: sent.status ?? 'open',
      totalCents: sent.total ?? positiveItems.reduce((sum, i) => sum + i.amountCents, 0),
    };
  }

  private normalizeCouponId(label: string): string {
    const slug = label
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 40);
    return `spiriment_${slug || 'discount'}`;
  }

  constructWebhookEvent(payload: Buffer, signature: string): any {
    const secret = process.env.STRIPE_WEBHOOK_SECRET ?? '';
    return this.client.webhooks.constructEvent(payload, signature, secret);
  }
}

export const stripeService = new StripeService();
