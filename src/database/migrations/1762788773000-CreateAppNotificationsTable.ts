import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAppNotificationsTable1762788773000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create app_notifications table
    await queryRunner.query(`
      CREATE TABLE \`app_notifications\` (
        \`id\` varchar(36) NOT NULL,
        \`userId\` varchar(36) NOT NULL,
        \`type\` enum('session_request','session_confirmed','session_rescheduled','session_declined','session_reminder','message','system') NOT NULL DEFAULT 'system',
        \`title\` varchar(255) NOT NULL,
        \`message\` text NOT NULL,
        \`isRead\` tinyint NOT NULL DEFAULT 0,
        \`readAt\` datetime NULL,
        \`data\` json NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_app_notifications_userId\` (\`userId\`),
        INDEX \`IDX_app_notifications_type\` (\`type\`),
        INDEX \`IDX_app_notifications_isRead\` (\`isRead\`),
        INDEX \`IDX_app_notifications_createdAt\` (\`createdAt\`),
        CONSTRAINT \`FK_app_notifications_user\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop app_notifications table
    await queryRunner.query(`DROP TABLE \`app_notifications\``);
  }
}

