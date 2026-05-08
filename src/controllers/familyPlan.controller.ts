import { Request, Response, NextFunction } from 'express';
import { familyPlanService } from '@/services/familyPlan.service';
import { AppError } from '@/common';
import { SubscriptionTier } from '@/database/entities/userSubscription.entity';

const VALID_TIERS: SubscriptionTier[] = ['basic', 'pro', 'premium'];

export const createFamilyPlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.body as { name?: string };
    if (!name?.trim()) throw new AppError('name is required', 400);
    const plan = await familyPlanService.createFamilyPlan(req.user!, name.trim());
    res.status(201).json({ success: true, data: plan });
  } catch (e) { next(e); }
};

export const getMyFamilyPlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await familyPlanService.getFamilyOverview(req.user!.id);
    res.json({ success: true, data });
  } catch (e) { next(e); }
};

export const addFamilyMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planId } = req.params;
    const { userId, tier } = req.body as { userId?: string; tier?: string };
    if (!userId) throw new AppError('userId is required', 400);
    if (!tier || !VALID_TIERS.includes(tier as SubscriptionTier)) {
      throw new AppError('tier must be basic, pro, or premium', 400);
    }
    const result = await familyPlanService.addMember(planId, req.user!, userId, tier as SubscriptionTier);
    res.status(201).json({ success: true, data: result });
  } catch (e) { next(e); }
};

export const removeFamilyMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planId, memberId } = req.params;
    await familyPlanService.removeMember(planId, req.user!, memberId);
    res.json({ success: true, data: { removed: true } });
  } catch (e) { next(e); }
};

export const changeFamilyMemberTier = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planId, memberId } = req.params;
    const { tier } = req.body as { tier?: string };
    if (!tier || !VALID_TIERS.includes(tier as SubscriptionTier)) {
      throw new AppError('tier must be basic, pro, or premium', 400);
    }
    const result = await familyPlanService.changeMemberTier(planId, req.user!, memberId, tier as SubscriptionTier);
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
};
