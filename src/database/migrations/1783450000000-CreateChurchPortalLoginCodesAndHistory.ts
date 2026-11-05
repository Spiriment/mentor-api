import { MigrationInterface, QueryRunner } from 'typeorm';

/** Emailed sign-in codes for pastors, and the history of who did what in a church's portal. */
export class CreateChurchPortalLoginCodesAndHistory1783450000000 implements MigrationInterface {
  name = 'CreateChurchPortalLoginCodesAndHistory1783450000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('church_portal_login_codes'))) {
      await queryRunner.query(`
        CREATE TABLE \`church_portal_login_codes\` (
          \`id\` varchar(36) NOT NULL,
          \`portalUserId\` varchar(36) NOT NULL,
          \`codeHash\` varchar(255) NOT NULL,
          \`expiresAt\` datetime NOT NULL,
          \`attempts\` int NOT NULL DEFAULT 0,
          \`usedAt\` datetime NULL,
          \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          PRIMARY KEY (\`id\`),
          INDEX \`IDX_church_portal_login_codes_user\` (\`portalUserId\`, \`createdAt\`)
        ) ENGINE=InnoDB
      `);
    }
    if (!(await queryRunner.hasTable('church_portal_history'))) {
      await queryRunner.query(`
        CREATE TABLE \`church_portal_history\` (
          \`id\` varchar(36) NOT NULL,
          \`churchPortalId\` varchar(36) NOT NULL,
          \`actorPortalUserId\` varchar(36) NULL,
          \`actorName\` varchar(255) NOT NULL,
          \`action\` varchar(64) NOT NULL,
          \`targetName\` varchar(255) NULL,
          \`detail\` varchar(255) NULL,
          \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          PRIMARY KEY (\`id\`),
          INDEX \`IDX_church_portal_history_portal_created\` (\`churchPortalId\`, \`createdAt\`)
        ) ENGINE=InnoDB
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('church_portal_history')) {
      await queryRunner.query('DROP TABLE `church_portal_history`');
    }
    if (await queryRunner.hasTable('church_portal_login_codes')) {
      await queryRunner.query('DROP TABLE `church_portal_login_codes`');
    }
  }
}
