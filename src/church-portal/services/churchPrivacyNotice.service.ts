import { z } from 'zod';
import { AppDataSource } from '@/config/data-source';
import { ChurchPrivacyAcceptance } from '../entities/churchPrivacyAcceptance.entity';

/**
 * The notice's wording lives in the app (src/constants/churchPrivacyNotice.ts). When it changes
 * materially, set the new date both there and here: members are then asked to agree again.
 */
export const CHURCH_PRIVACY_NOTICE_VERSION = '2026-11-05';

export const privacyNoticeVersionSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid privacy notice version');

export type PrivacyAcceptanceSource = 'join' | 'existing_member';

export class ChurchPrivacyNoticeService {
  /** Records the version the member was actually shown. Agreeing twice changes nothing. */
  async recordAcceptance(
    userId: string,
    churchPortalId: string,
    noticeVersion: string,
    source: PrivacyAcceptanceSource,
  ): Promise<void> {
    await AppDataSource.getRepository(ChurchPrivacyAcceptance)
      .createQueryBuilder()
      .insert()
      .values({ userId, churchPortalId, noticeVersion, source })
      .orIgnore()
      .execute();
  }

  async hasAcceptedCurrent(userId: string, churchPortalId: string): Promise<boolean> {
    return AppDataSource.getRepository(ChurchPrivacyAcceptance).exists({
      where: { userId, churchPortalId, noticeVersion: CHURCH_PRIVACY_NOTICE_VERSION },
    });
  }
}

export const churchPrivacyNoticeService = new ChurchPrivacyNoticeService();
