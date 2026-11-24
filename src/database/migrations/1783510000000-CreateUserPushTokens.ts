import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Push tokens per device (see UserPushToken). Copies each user's current token in, so
 * nobody stops getting notifications when this goes live.
 */
export class CreateUserPushTokens1783510000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('user_push_tokens'))) {
      await queryRunner.query(`
        CREATE TABLE \`user_push_tokens\` (
          \`id\` varchar(36) NOT NULL,
          \`userId\` varchar(36) NOT NULL,
          \`token\` varchar(255) NOT NULL,
          \`platform\` varchar(10) NULL,
          \`lastSeenAt\` datetime NOT NULL,
          \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`UQ_user_push_tokens_token\` (\`token\`),
          INDEX \`IDX_user_push_tokens_user\` (\`userId\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    }
    // One row per distinct token; if two accounts somehow share one, the most recently
    // updated account keeps it (INSERT IGNORE skips the later duplicates, so order by recency)
    await queryRunner.query(`
      INSERT IGNORE INTO \`user_push_tokens\` (\`id\`, \`userId\`, \`token\`, \`platform\`, \`lastSeenAt\`)
      SELECT UUID(), u.\`id\`, u.\`pushToken\`, u.\`pushPlatform\`, COALESCE(u.\`updatedAt\`, NOW())
        FROM \`users\` u
       WHERE u.\`pushToken\` IS NOT NULL AND u.\`pushToken\` <> ''
       ORDER BY u.\`updatedAt\` DESC
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `user_push_tokens`');
  }
}
