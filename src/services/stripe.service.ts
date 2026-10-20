import Stripe = require('stripe');
import { AppDataSource } from '@/config/data-source';
import { User } from '@/database/entities/user.entity';
import { AppError } from '@/common';
import { isChurchCouponId, planChurchCouponUpdate, type ChurchCouponMode } from '@/common/churchBilling';

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

  /**
   * Move an existing subscription to another tier/interval in place. Stripe prorates: the
   * unused part of the old price is credited and the new price charged for the rest of the
   * period (no second subscription, no paying twice). Discounts on it are kept.
   */
  async changeSubscriptionPrice(
    subscriptionId: string,
    tier: 'basic' | 'pro' | 'premium',
    interval: 'monthly' | 'annual',
  ): Promise<void> {
    const priceId = TIER_PRICE_MAP[interval === 'annual' ? `${tier}_annual` : tier];
    if (!priceId) throw new AppError(`Price ID for tier "${tier}" is not configured`, 500);

    const sub = await this.client.subscriptions.retrieve(subscriptionId);
    const item = sub.items.data[0];
    if (!item) throw new AppError('Subscription has no items', 500);
    if (item.price?.id === priceId) return;

    await this.client.subscriptions.update(subscriptionId, {
      items: [{ id: item.id, price: priceId }],
      proration_behavior: 'create_prorations',
      metadata: { ...(sub.metadata ?? {}), tier },
    });
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
    const baseId = this.normalizeCouponId(promoCode);

    // Coupon IDs are permanent and their percent can't be edited. When a label's discount
    // changes (a church passing 100 members, a family member's age bracket, an edited promo),
    // re-creating the same ID fails with "already exists" and checkout breaks, so the new
    // percent gets its own ID instead.
    for (const id of [baseId, `${baseId}_${discountPercent}pct`]) {
      const existing = await this.retrieveCoupon(id);
      if (!existing) return this.createPercentCoupon(id, discountPercent, promoCode);
      if (existing.valid && existing.percent_off === discountPercent) return existing.id;
    }
    // Both IDs are taken by deleted/expired coupons
    return this.createPercentCoupon(
      `${baseId}_${discountPercent}pct_${Date.now().toString(36)}`,
      discountPercent,
      promoCode,
    );
  }

  private async retrieveCoupon(id: string) {
    try {
      return await this.client.coupons.retrieve(id);
    } catch (err: any) {
      if (err?.code === 'resource_missing') return null;
      throw err;
    }
  }

  private async createPercentCoupon(id: string, discountPercent: number, promoCode: string): Promise<string> {
    try {
      const coupon = await this.client.coupons.create({
        id,
        percent_off: discountPercent,
        duration: 'forever',
        // Stripe caps coupon names at 40 characters; "Promo: family-age-<uuid>" is 54, which
        // made every youth family-member checkout fail
        name: `${discountPercent}% ${promoCode}`.slice(0, 40),
        metadata: { promoCode },
      });
      return coupon.id;
    } catch (err: any) {
      // Two checkouts racing to create the same coupon: use the one that won
      if (err?.code === 'resource_already_exists') {
        const existing = await this.retrieveCoupon(id);
        if (existing?.valid && existing.percent_off === discountPercent) return existing.id;
      }
      throw err;
    }
  }

  /**
   * Replace the church coupon on a member's own Stripe subscription with the coupon they
   * qualify for now (or remove it when that resolves to null). Other discounts are kept;
   * `mode` says whether a subscription without a church coupon may get one (see
   * planChurchCouponUpdate). Takes effect from the next invoice. Returns true when it changed anything.
   */
  async replaceChurchCoupon(
    subscriptionId: string,
    resolveDesiredCouponId: () => Promise<string | null>,
    mode: ChurchCouponMode = 'sync',
  ): Promise<boolean> {
    const sub = await this.client.subscriptions.retrieve(subscriptionId, { expand: ['discounts'] });
    if (sub.status === 'canceled' || sub.status === 'incomplete_expired') return false;

    const applied = (sub.discounts ?? [])
      .flatMap((d) => (typeof d === 'string' ? [] : [d]))
      .map((d) => ({
        id: d.id,
        couponId: typeof d.source?.coupon === 'string' ? d.source.coupon : d.source?.coupon?.id ?? null,
      }));
    const hasChurchCoupon = applied.some((d) => isChurchCouponId(d.couponId));
    if (!hasChurchCoupon && (mode === 'sync' || (mode === 'join' && applied.length > 0))) return false;

    // Resolved only now, so subscriptions that won't change don't create coupons
    const next = planChurchCouponUpdate(applied, await resolveDesiredCouponId(), mode);
    if (!next) return false;

    await this.client.subscriptions.update(subscriptionId, {
      discounts: next.length > 0 ? next : '',
      proration_behavior: 'none',
    });
    return true;
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
    createdAt: string;
    dueAt: string | null;
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

    // Create the invoice first and attach each item to it. The old order (items, then invoice)
    // breaks on this API version: new invoices exclude pending items by default, so the invoice
    // came out empty and the items stayed pending on the customer, where Stripe would add them
    // to that customer's next subscription invoice. This customer is found by email, so it can
    // be an app user who also pays their own subscription.
    const expectedCents = positiveItems.reduce((sum, i) => sum + i.amountCents, 0);
    const invoice = await this.client.invoices.create({
      customer: customerId,
      collection_method: 'send_invoice',
      days_until_due: params.daysUntilDue ?? 14,
      description: params.description,
      metadata: params.metadata ?? {},
      pending_invoice_items_behavior: 'exclude',
      // Finalized below once every item is attached, not by Stripe's timer
      auto_advance: false,
    });

    let sent: Awaited<ReturnType<typeof this.client.invoices.sendInvoice>>;
    try {
      for (const item of positiveItems) {
        await this.client.invoiceItems.create({
          customer: customerId,
          invoice: invoice.id,
          amount: item.amountCents,
          currency: 'eur',
          description: item.description,
          // Prices are already discounted; a customer-level coupon must not apply twice
          discountable: false,
          metadata: { source: 'central_invoice', ...(params.metadata ?? {}) },
        });
      }

      const draft = await this.client.invoices.retrieve(invoice.id);
      if (draft.total !== expectedCents) {
        throw new AppError(
          `Invoice total mismatch (expected ${expectedCents} cents, Stripe has ${draft.total}); nothing was sent`,
          500,
        );
      }

      const finalized = await this.client.invoices.finalizeInvoice(invoice.id, { auto_advance: true });
      sent = await this.client.invoices.sendInvoice(finalized.id);
    } catch (err) {
      // Don't leave a half-built draft (or its items) on the customer. Deleting a draft
      // invoice deletes the items attached to it.
      await this.client.invoices
        .retrieve(invoice.id)
        .then((inv) => (inv.status === 'draft' ? this.client.invoices.del(invoice.id) : undefined))
        .catch(() => undefined);
      throw err;
    }

    return {
      invoiceId: sent.id,
      hostedInvoiceUrl: sent.hosted_invoice_url ?? null,
      invoicePdf: sent.invoice_pdf ?? null,
      status: sent.status ?? 'open',
      totalCents: sent.total ?? expectedCents,
      createdAt: new Date((sent.created ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
      dueAt: sent.due_date ? new Date(sent.due_date * 1000).toISOString() : null,
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
