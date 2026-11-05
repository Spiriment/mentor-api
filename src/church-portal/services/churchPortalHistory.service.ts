import { AppDataSource } from '@/config/data-source';
import { logger } from '@/config/int-services';
import { User } from '@/database/entities/user.entity';
import { ChurchPortal } from '../entities/churchPortal.entity';
import { ChurchPortalHistoryEntry } from '../entities/churchPortalHistoryEntry.entity';
import { ChurchPortalUser } from '../entities/churchPortalUser.entity';

export type ChurchHistoryAction =
  | 'team.invited'
  | 'team.invite_resent'
  | 'team.invite_cancelled'
  | 'team.role_changed'
  | 'team.access_removed'
  | 'team.access_restored'
  | 'member.approved'
  | 'member.rejected'
  | 'member.removed'
  | 'billing.member_covered'
  | 'billing.member_tier_changed'
  | 'billing.member_uncovered'
  | 'billing.settings_changed'
  | 'billing.invoice_sent'
  | 'export.downloaded';

/** A portal user, or a label for anyone else: Spiriment support, or the automatic invoice */
export type ChurchHistoryActor = { portalUserId: string } | { label: string };

const MAX_PAGE_SIZE = 100;

function displayName(person: { firstName?: string | null; lastName?: string | null; email?: string | null } | null) {
  if (!person) return null;
  return [person.firstName, person.lastName].filter(Boolean).join(' ') || person.email || null;
}

export class ChurchPortalHistoryService {
  /**
   * Called after the action has happened, so a problem here must never make it look like the
   * action failed. If this can't write, the error is logged and the entry is missing.
   */
  async record(input: {
    churchPortalId: string;
    actor: ChurchHistoryActor;
    action: ChurchHistoryAction;
    targetName?: string | null;
    detail?: string | null;
  }): Promise<void> {
    try {
      let actorName: string;
      let actorPortalUserId: string | null = null;
      if ('label' in input.actor) {
        actorName = input.actor.label;
      } else {
        actorPortalUserId = input.actor.portalUserId;
        actorName = (await this.teamMemberName(actorPortalUserId)) ?? 'A team member';
      }
      const repo = AppDataSource.getRepository(ChurchPortalHistoryEntry);
      await repo.insert({
        churchPortalId: input.churchPortalId,
        actorPortalUserId,
        actorName,
        action: input.action,
        targetName: input.targetName ?? null,
        detail: input.detail ?? null,
      });
    } catch (err) {
      logger.error('Could not record church portal history', err instanceof Error ? err : new Error(String(err)), {
        churchPortalId: input.churchPortalId,
        action: input.action,
      });
    }
  }

  /** For invoices, which only know the billing plan */
  async recordForPlan(
    orgPlanId: string,
    entry: { actor: ChurchHistoryActor; action: ChurchHistoryAction; detail?: string | null },
  ): Promise<void> {
    try {
      const portal = await AppDataSource.getRepository(ChurchPortal).findOne({
        where: { orgPlanId },
        select: ['id'],
      });
      if (portal) await this.record({ churchPortalId: portal.id, ...entry });
    } catch (err) {
      logger.error('Could not record church portal history', err instanceof Error ? err : new Error(String(err)), {
        orgPlanId,
        action: entry.action,
      });
    }
  }

  async teamMemberName(portalUserId: string): Promise<string | null> {
    const user = await AppDataSource.getRepository(ChurchPortalUser).findOne({
      where: { id: portalUserId },
      select: ['id', 'firstName', 'lastName', 'email'],
    });
    return displayName(user);
  }

  async memberName(userId: string): Promise<string | null> {
    const user = await AppDataSource.getRepository(User).findOne({
      where: { id: userId },
      select: ['id', 'firstName', 'lastName', 'email'],
    });
    return displayName(user);
  }

  async list(churchPortalId: string, page = 1, limit = 20) {
    const take = Math.min(Math.max(limit || 20, 1), MAX_PAGE_SIZE);
    const current = Math.max(page || 1, 1);
    const [entries, total] = await AppDataSource.getRepository(ChurchPortalHistoryEntry).findAndCount({
      where: { churchPortalId },
      order: { createdAt: 'DESC' },
      take,
      skip: (current - 1) * take,
    });
    return {
      data: entries.map((e) => ({
        id: e.id,
        at: e.createdAt,
        actorName: e.actorName,
        action: e.action,
        targetName: e.targetName ?? null,
        detail: e.detail ?? null,
      })),
      meta: { total, page: current, limit: take, totalPages: Math.ceil(total / take) },
    };
  }
}

export const churchPortalHistory = new ChurchPortalHistoryService();
