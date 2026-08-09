import { MigrationInterface, QueryRunner } from 'typeorm';

export class DedupeScheduledNotifications1782400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Collapse any existing duplicate rows (same user + type) down to the most
    // recent one before adding the unique constraint, or the ALTER will fail.
    await queryRunner.query(`
      DELETE t1 FROM \`scheduled_notifications\` t1
      INNER JOIN \`scheduled_notifications\` t2
        ON t1.\`userId\` = t2.\`userId\`
        AND t1.\`type\` = t2.\`type\`
        AND t1.\`id\` < t2.\`id\`
    `);

    const table = await queryRunner.getTable('scheduled_notifications');
    const hasIndex = table?.indices.some(
      (idx) => idx.name === 'IDX_scheduled_notifications_user_type'
    );
    if (!hasIndex) {
      await queryRunner.query(`
        ALTER TABLE \`scheduled_notifications\`
        ADD UNIQUE INDEX \`IDX_scheduled_notifications_user_type\` (\`userId\`, \`type\`)
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('scheduled_notifications');
    const hasIndex = table?.indices.some(
      (idx) => idx.name === 'IDX_scheduled_notifications_user_type'
    );
    if (hasIndex) {
      await queryRunner.query(`
        ALTER TABLE \`scheduled_notifications\`
        DROP INDEX \`IDX_scheduled_notifications_user_type\`
      `);
    }
  }
}
