import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAdminUsersAndAuditLogs1770300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`admin_users\` (
        \`id\` varchar(36) NOT NULL,
        \`email\` varchar(255) NOT NULL,
        \`password\` varchar(255) NOT NULL,
        \`role\` enum('super_admin','support') NOT NULL,
        \`isActive\` tinyint NOT NULL DEFAULT 1,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_admin_users_email\` (\`email\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE \`admin_audit_logs\` (
        \`id\` varchar(36) NOT NULL,
        \`adminUserId\` varchar(36) NOT NULL,
        \`action\` varchar(128) NOT NULL,
        \`targetType\` varchar(64) NULL,
        \`targetId\` varchar(64) NULL,
        \`metadata\` json NULL,
        \`ip\` varchar(45) NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX \`IDX_admin_audit_logs_adminUserId_createdAt\` (\`adminUserId\`, \`createdAt\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`admin_audit_logs\``);
    await queryRunner.query(`DROP TABLE \`admin_users\``);
  }
}
