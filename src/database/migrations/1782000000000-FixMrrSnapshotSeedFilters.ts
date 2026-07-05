import { MigrationInterface, QueryRunner } from 'typeorm';

/** Align seeded MRR snapshot with runtime MRR filters (active + past_due paid tiers only). */
export class FixMrrSnapshotSeedFilters1782000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO \`mrr_snapshots\` (\`id\`, \`year\`, \`month\`, \`mrrCents\`, \`currency\`, \`activeSubscribers\`, \`createdAt\`, \`updatedAt\`)
      SELECT
        UUID(),
        YEAR(UTC_TIMESTAMP()),
        MONTH(UTC_TIMESTAMP()),
        COALESCE(SUM(\`mrrCents\`), 0),
        'EUR',
        COUNT(*),
        NOW(6),
        NOW(6)
      FROM \`user_subscriptions\`
      WHERE \`status\` IN ('active', 'past_due')
        AND \`tier\` IN ('basic', 'pro', 'premium')
      ON DUPLICATE KEY UPDATE
        \`mrrCents\` = VALUES(\`mrrCents\`),
        \`activeSubscribers\` = VALUES(\`activeSubscribers\`),
        \`updatedAt\` = NOW(6)
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // No rollback — snapshot values are recomputed on next cron capture.
  }
}
