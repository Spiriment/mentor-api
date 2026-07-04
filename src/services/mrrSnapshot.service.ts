import { In } from 'typeorm';
import { AppDataSource } from '@/config/data-source';
import { MrrSnapshot } from '@/database/entities/mrrSnapshot.entity';
import { SubscriptionStatus } from '@/database/entities/userSubscription.entity';
import { UserSubscription } from '@/database/entities/userSubscription.entity';
import { logger } from '@/config/int-services';

const ACTIVE_STATUSES: SubscriptionStatus[] = ['active', 'trialing', 'past_due'];

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export class MrrSnapshotService {
  private get repo() {
    return AppDataSource.getRepository(MrrSnapshot);
  }

  private get subRepo() {
    return AppDataSource.getRepository(UserSubscription);
  }

  async getCurrentMrrTotals(): Promise<{ mrrCents: number; activeSubscribers: number }> {
    const mrrRow = await this.subRepo
      .createQueryBuilder('s')
      .select('COALESCE(SUM(s.mrrCents), 0)', 'sum')
      .where('s.status IN (:...st)', { st: ACTIVE_STATUSES })
      .getRawOne<{ sum: string }>();

    const activeSubscribers = await this.subRepo.count({
      where: { status: In(ACTIVE_STATUSES) },
    });

    return {
      mrrCents: mrrRow?.sum ? parseInt(mrrRow.sum, 10) : 0,
      activeSubscribers,
    };
  }

  async captureCurrentMonthSnapshot(): Promise<MrrSnapshot> {
    const { mrrCents, activeSubscribers } = await this.getCurrentMrrTotals();
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;

    let snapshot = await this.repo.findOne({ where: { year, month } });
    if (snapshot) {
      snapshot.mrrCents = mrrCents;
      snapshot.activeSubscribers = activeSubscribers;
      snapshot.currency = 'EUR';
    } else {
      snapshot = this.repo.create({
        year,
        month,
        mrrCents,
        activeSubscribers,
        currency: 'EUR',
      });
    }

    await this.repo.save(snapshot);
    logger.info('MRR snapshot captured', { year, month, mrrCents, activeSubscribers });
    return snapshot;
  }

  async getRevenueHistory(monthCount = 12): Promise<
    Array<{ month: string; year: number; revenueCents: number }>
  > {
    const now = new Date();
    const targets: Array<{ year: number; month: number }> = [];

    for (let i = monthCount - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      targets.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 });
    }

    const snapshots = await this.repo.find();
    const byKey = new Map(snapshots.map((s) => [`${s.year}-${s.month}`, s]));

    const { mrrCents: liveMrrCents } = await this.getCurrentMrrTotals();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth() + 1;

    return targets.map(({ year, month }) => {
      const snap = byKey.get(`${year}-${month}`);
      const isCurrentMonth = year === currentYear && month === currentMonth;
      return {
        month: MONTH_LABELS[month - 1],
        year,
        revenueCents: isCurrentMonth ? liveMrrCents : (snap?.mrrCents ?? 0),
      };
    });
  }
}

export const mrrSnapshotService = new MrrSnapshotService();
