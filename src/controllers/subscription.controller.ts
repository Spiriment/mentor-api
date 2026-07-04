import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { SubscriptionService } from '@/services/subscription.service';
import { EmailService } from '@/core/email.service';
import { AppError } from '@/common';

const emailService = new EmailService(null);
const subscriptionService = new SubscriptionService(emailService);

export const getMySubscription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await subscriptionService.getSubscriptionForUser(req.user!.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const createCheckout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tier, interval } = req.body as { tier: 'basic' | 'pro' | 'premium'; interval?: 'monthly' | 'annual' };
    if (!['basic', 'pro', 'premium'].includes(tier)) {
      throw new AppError('Invalid tier. Must be basic, pro, or premium.', 400);
    }
    const billingInterval: 'monthly' | 'annual' = interval === 'annual' ? 'annual' : 'monthly';
    const url = await subscriptionService.createCheckoutSession(req.user!, tier, billingInterval);
    res.json({ success: true, data: { url } });
  } catch (err) {
    next(err);
  }
};

export const getBillingPortal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const url = await subscriptionService.getBillingPortalUrl(req.user!);
    res.json({ success: true, data: { url } });
  } catch (err) {
    next(err);
  }
};

export const cancelSubscription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await subscriptionService.cancelSubscription(req.user!.id);
    res.json({ success: true, message: 'Subscription cancelled. Access continues until the end of the billing period.' });
  } catch (err) {
    next(err);
  }
};

export const redeemPromoCode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.body as { code: string };
    if (!code || typeof code !== 'string') {
      throw new AppError('Promo code is required', 400);
    }
    const result = await subscriptionService.redeemPromoCode(req.user!, code.trim().toUpperCase());
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

export const acknowledgeTrialExpired = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await subscriptionService.acknowledgeTrialExpired(req.user!.id);
    const subscription = await subscriptionService.getSubscriptionForUser(req.user!.id);
    res.json({ success: true, data: subscription });
  } catch (err) {
    next(err);
  }
};

export const syncAppleIAP = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Subscriptions are synced via RevenueCat webhooks — client-initiated grants are not allowed
    throw new AppError(
      'Subscription sync is handled automatically. Use Restore Purchases if your plan is missing.',
      StatusCodes.FORBIDDEN,
    );
  } catch (err) {
    next(err);
  }
};
