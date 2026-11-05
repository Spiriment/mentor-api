import { AppDataSource } from '@/config/data-source';
import { logger } from '@/config/int-services';
import { ConflictError, ForbiddenError, NotFoundError } from '@/common/errors';
import type { AdminChurchPortalService } from '@/services/adminChurchPortal.service';
import { ChurchPortalRefreshToken } from '../entities/churchPortalRefreshToken.entity';
import { ChurchPortalUser } from '../entities/churchPortalUser.entity';
import { assertCanChangeTeamMember } from '../utils/teamRules';
import { churchPortalHistory } from './churchPortalHistory.service';

type TeamRole = 'pastor' | 'deacon' | 'leader';

/**
 * Pastors managing their own church's portal admins. Invites work exactly as they do for
 * Spiriment admins, so those are reused, always with the church from the pastor's own token.
 */
export class ChurchPortalTeamService {
  constructor(private readonly portals: AdminChurchPortalService) {}

  list(churchPortalId: string) {
    return this.portals.listPortalUsers(churchPortalId);
  }

  async invite(
    churchPortalId: string,
    actorId: string,
    input: { email: string; firstName?: string; lastName?: string; role: TeamRole },
  ) {
    const result = await this.portals.createPortalUser(churchPortalId, input);
    logger.info('Church team: member invited', { churchPortalId, actorId, invitedId: result.id, role: input.role });
    await churchPortalHistory.record({
      churchPortalId,
      actor: { portalUserId: actorId },
      action: 'team.invited',
      targetName: [input.firstName, input.lastName].filter(Boolean).join(' ') || input.email,
      detail: input.role,
    });
    return result;
  }

  async resend(churchPortalId: string, actorId: string, targetId: string, email?: string) {
    const result = await this.portals.resendInvite(churchPortalId, targetId, email);
    logger.info('Church team: invite resent', { churchPortalId, actorId, targetId, emailChanged: !!result.emailChangedFrom });
    await churchPortalHistory.record({
      churchPortalId,
      actor: { portalUserId: actorId },
      action: 'team.invite_resent',
      targetName: await churchPortalHistory.teamMemberName(targetId).catch(() => null),
    });
    return result;
  }

  async cancelInvite(churchPortalId: string, actorId: string, targetId: string) {
    // The invite is deleted below, so get the name first
    const targetName = await churchPortalHistory.teamMemberName(targetId).catch(() => null);
    const result = await this.portals.cancelInvite(churchPortalId, targetId);
    logger.info('Church team: invite cancelled', { churchPortalId, actorId, targetId });
    await churchPortalHistory.record({
      churchPortalId,
      actor: { portalUserId: actorId },
      action: 'team.invite_cancelled',
      targetName: targetName ?? result.email,
    });
    return result;
  }

  /**
   * Change someone's role or switch their access off or on. The role is read from the database on
   * every request, so a change applies straight away. You can't change yourself, which also means
   * the church always keeps at least one active pastor: the one making the change.
   */
  async update(
    churchPortalId: string,
    actorId: string,
    targetId: string,
    changes: { role?: TeamRole; isActive?: boolean },
  ) {
    assertCanChangeTeamMember(actorId, targetId, ForbiddenError);

    const repo = AppDataSource.getRepository(ChurchPortalUser);
    const target = await repo.findOne({
      where: { id: targetId, churchPortalId },
      select: ['id', 'email', 'role', 'isActive', 'password'],
    });
    if (!target) throw new NotFoundError('Team member not found');

    if (changes.isActive !== undefined && !target.password) {
      throw new ConflictError("This invite hasn't been accepted yet. Cancel the invite instead.");
    }

    await repo.update(targetId, changes);

    // Old sessions shouldn't come back to life if the account is reactivated later
    if (changes.isActive === false) {
      await AppDataSource.getRepository(ChurchPortalRefreshToken).delete({ churchPortalUserId: targetId });
    }

    logger.info('Church team: member updated', { churchPortalId, actorId, targetId, changes });

    const targetName = await churchPortalHistory.teamMemberName(targetId).catch(() => null);
    if (changes.role !== undefined && changes.role !== target.role) {
      await churchPortalHistory.record({
        churchPortalId,
        actor: { portalUserId: actorId },
        action: 'team.role_changed',
        targetName,
        detail: changes.role,
      });
    }
    if (changes.isActive !== undefined && changes.isActive !== target.isActive) {
      await churchPortalHistory.record({
        churchPortalId,
        actor: { portalUserId: actorId },
        action: changes.isActive ? 'team.access_restored' : 'team.access_removed',
        targetName,
      });
    }

    return { message: `${target.email} updated` };
  }
}
