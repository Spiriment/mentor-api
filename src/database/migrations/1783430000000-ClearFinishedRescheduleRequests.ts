import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Accepting or declining a reschedule set the request fields to undefined, which save()
 * skips, so the request stayed on the session: the mentee's app kept showing
 * "Reschedule Pending" and refused to join. Clears requests that are really over:
 * accepted (the session already moved to the requested time), declined (a decline
 * notification came after the request), for a time that has passed, or on a session
 * that is no longer upcoming.
 */
export class ClearFinishedRescheduleRequests1783430000000 implements MigrationInterface {
  name = 'ClearFinishedRescheduleRequests1783430000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE \`sessions\` s
      SET s.\`previousScheduledAt\` = NULL,
          s.\`rescheduleRequestedAt\` = NULL,
          s.\`requestedScheduledAt\` = NULL,
          s.\`rescheduleReason\` = NULL,
          s.\`rescheduleMessage\` = NULL
      WHERE (s.\`rescheduleRequestedAt\` IS NOT NULL OR s.\`requestedScheduledAt\` IS NOT NULL)
        AND (
          s.\`requestedScheduledAt\` IS NULL
          OR s.\`requestedScheduledAt\` = s.\`scheduledAt\`
          OR s.\`requestedScheduledAt\` <= ?
          OR s.\`status\` NOT IN ('scheduled', 'confirmed')
          OR EXISTS (
            SELECT 1 FROM \`app_notifications\` n
            WHERE n.\`type\` = 'reschedule_declined'
              AND JSON_UNQUOTE(JSON_EXTRACT(n.\`data\`, '$.sessionId')) = s.\`id\`
              AND n.\`createdAt\` >= COALESCE(s.\`rescheduleRequestedAt\`, '1970-01-01')
          )
        )
    `, [new Date()]); // a Date param, so it's written in the same zone the app stores in
  }

  public async down(): Promise<void> {
    // Data repair only: the cleared requests were already finished
  }
}
