import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMrrSnapshots1781700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ db }] = await queryRunner.query(`SELECT DATABASE() as db`);
    const tableRows = await queryRunner.query(
      `
        SELECT COUNT(*) as count
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = ?
          AND TABLE_NAME = ?
      `,
      [db, 'mrr_snapshots'],
    );

    if (Number(tableRows[0]?.count) === 0) {
      await queryRunner.query(`
        CREATE TABLE \`mrr_snapshots\` (
          \`id\` varchar(36) NOT NULL,
          \`year\` smallint NOT NULL,
          \`month\` tinyint NOT NULL,
          \`mrrCents\` int NOT NULL DEFAULT 0,
          \`currency\` varchar(8) NOT NULL DEFAULT 'EUR',
          \`activeSubscribers\` int NOT NULL DEFAULT 0,
          \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`IDX_mrr_snapshots_year_month\` (\`year\`, \`month\`)
        ) ENGINE=InnoDB
      `);
    }

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
      WHERE \`status\` IN ('active', 'trialing', 'past_due')
      ON DUPLICATE KEY UPDATE
        \`mrrCents\` = VALUES(\`mrrCents\`),
        \`activeSubscribers\` = VALUES(\`activeSubscribers\`),
        \`updatedAt\` = NOW(6)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`mrr_snapshots\``);
  }
}
