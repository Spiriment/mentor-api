import { AppDataSource } from '@/config/data-source';
import { User } from '@/database/entities/user.entity';
import { Referral } from '@/database/entities/referral.entity';
import { AppError } from '@/common/errors';
import { v4 as uuidv4 } from 'uuid';

const POINTS_PER_REFERRAL = 10;
const CODE_LENGTH = 8;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars

function generateCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

export class ReferralService {
  private userRepo = AppDataSource.getRepository(User);
  private referralRepo = AppDataSource.getRepository(Referral);

  /** Get or create a referral code for a mentor */
  async getOrCreateCode(mentorId: string): Promise<{ referralCode: string; referralPoints: number; referralCount: number }> {
    const user = await this.userRepo.findOne({
      where: { id: mentorId },
      select: ['id', 'role', 'referralCode', 'referralPoints'],
    });

    if (!user) throw new AppError('User not found', 404);
    if (user.role !== 'mentor') throw new AppError('Only mentors can have referral codes', 403);

    if (!user.referralCode) {
      // Generate unique code
      let code: string;
      let attempts = 0;
      do {
        code = generateCode();
        attempts++;
        if (attempts > 20) throw new AppError('Could not generate unique referral code', 500);
        const existing = await this.userRepo.findOne({ where: { referralCode: code }, select: ['id'] });
        if (!existing) break;
      } while (true);

      await this.userRepo.update(mentorId, { referralCode: code! });
      user.referralCode = code!;
    }

    const referralCount = await this.referralRepo.count({ where: { referrerId: mentorId } });

    return {
      referralCode: user.referralCode,
      referralPoints: user.referralPoints,
      referralCount,
    };
  }

  /** Look up who owns a referral code (called during signup to validate) */
  async findReferrer(code: string): Promise<{ id: string; firstName?: string; lastName?: string } | null> {
    const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const user = await this.userRepo.findOne({
      where: { referralCode: normalized },
      select: ['id', 'firstName', 'lastName'],
    });
    return user ?? null;
  }

  /** Record a successful referral and award points — called after new user completes signup */
  async recordReferral(referrerId: string, newUserId: string): Promise<void> {
    // Idempotent — skip if already recorded
    const existing = await this.referralRepo.findOne({ where: { referredUserId: newUserId } });
    if (existing) return;

    const referral = this.referralRepo.create({
      id: uuidv4(),
      referrerId,
      referredUserId: newUserId,
      pointsAwarded: POINTS_PER_REFERRAL,
    });
    await this.referralRepo.save(referral);

    // Increment referrer's points
    await this.userRepo.increment({ id: referrerId }, 'referralPoints', POINTS_PER_REFERRAL);
  }

  /** Get referral stats for a mentor */
  async getStats(mentorId: string) {
    const user = await this.userRepo.findOne({
      where: { id: mentorId },
      select: ['referralCode', 'referralPoints'],
    });
    if (!user) throw new AppError('User not found', 404);

    const referrals = await this.referralRepo.find({
      where: { referrerId: mentorId },
      order: { createdAt: 'DESC' },
      take: 20,
    });

    const referredUserIds = referrals.map(r => r.referredUserId);
    let referredUsers: Pick<User, 'id' | 'firstName' | 'lastName' | 'role' | 'createdAt'>[] = [];
    if (referredUserIds.length > 0) {
      referredUsers = await this.userRepo.find({
        where: referredUserIds.map(id => ({ id })),
        select: ['id', 'firstName', 'lastName', 'role', 'createdAt'],
      });
    }

    const userMap = Object.fromEntries(referredUsers.map(u => [u.id, u]));

    return {
      referralCode: user.referralCode,
      referralPoints: user.referralPoints,
      referralCount: referrals.length,
      referrals: referrals.map(r => ({
        id: r.id,
        pointsAwarded: r.pointsAwarded,
        joinedAt: r.createdAt,
        user: userMap[r.referredUserId] ?? null,
      })),
    };
  }
}

export const referralService = new ReferralService();
