import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProcessedWebhookEvents1781800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ db }] = await queryRunner.query(`SELECT DATABASE() as db`);
    const tableRows = await queryRunner.query(
      `
        SELECT COUNT(*) as count
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = ?
          AND TABLE_NAME = ?
      `,
      [db, 'processed_webhook_events'],
    );

    if (Number(tableRows[0]?.count) === 0) {
      await queryRunner.query(`
        CREATE TABLE \`processed_webhook_events\` (
          \`id\` varchar(255) NOT NULL,
          \`provider\` varchar(32) NOT NULL,
          \`eventType\` varchar(64) NOT NULL,
          \`processedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `processed_webhook_events`');
  }
}
