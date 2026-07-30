import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmailCampaigns1782200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasCampaigns = await queryRunner.hasTable('email_campaigns');
    if (!hasCampaigns) {
      await queryRunner.query(`
        CREATE TABLE \`email_campaigns\` (
          \`id\` varchar(36) NOT NULL,
          \`name\` varchar(255) NOT NULL,
          \`subject\` varchar(500) NOT NULL,
          \`htmlContent\` longtext NOT NULL,
          \`audienceType\` enum('all_users','role_filter','excel_list') NOT NULL,
          \`audienceConfig\` json NULL,
          \`status\` enum('draft','scheduled','sending','sent','failed','cancelled') NOT NULL DEFAULT 'draft',
          \`scheduledAt\` datetime NULL,
          \`sentAt\` datetime NULL,
          \`createdByAdminId\` varchar(36) NOT NULL,
          \`totalRecipients\` int NOT NULL DEFAULT 0,
          \`sentCount\` int NOT NULL DEFAULT 0,
          \`failedCount\` int NOT NULL DEFAULT 0,
          \`replyTo\` varchar(255) NULL,
          \`isTemplate\` tinyint NOT NULL DEFAULT 0,
          \`templateName\` varchar(255) NULL,
          \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
          INDEX \`IDX_email_campaigns_status_scheduledAt\` (\`status\`, \`scheduledAt\`),
          INDEX \`IDX_email_campaigns_createdByAdminId\` (\`createdByAdminId\`),
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB
      `);
    }

    const hasRecipients = await queryRunner.hasTable('email_campaign_recipients');
    if (!hasRecipients) {
      await queryRunner.query(`
        CREATE TABLE \`email_campaign_recipients\` (
          \`id\` varchar(36) NOT NULL,
          \`campaignId\` varchar(36) NOT NULL,
          \`email\` varchar(255) NOT NULL,
          \`userId\` varchar(36) NULL,
          \`firstName\` varchar(255) NULL,
          \`status\` enum('pending','sent','failed','skipped') NOT NULL DEFAULT 'pending',
          \`errorMessage\` text NULL,
          \`sentAt\` datetime NULL,
          \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          INDEX \`IDX_email_campaign_recipients_campaignId_status\` (\`campaignId\`, \`status\`),
          INDEX \`IDX_email_campaign_recipients_email\` (\`email\`),
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB
      `);
    }

    const hasOptOut = await queryRunner.hasColumn('users', 'marketingEmailsOptOut');
    if (!hasOptOut) {
      await queryRunner.query(`
        ALTER TABLE \`users\`
        ADD \`marketingEmailsOptOut\` tinyint NOT NULL DEFAULT 0
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasOptOut = await queryRunner.hasColumn('users', 'marketingEmailsOptOut');
    if (hasOptOut) {
      await queryRunner.query(`
        ALTER TABLE \`users\` DROP COLUMN \`marketingEmailsOptOut\`
      `);
    }

    const hasRecipients = await queryRunner.hasTable('email_campaign_recipients');
    if (hasRecipients) {
      await queryRunner.query(`DROP TABLE \`email_campaign_recipients\``);
    }

    const hasCampaigns = await queryRunner.hasTable('email_campaigns');
    if (hasCampaigns) {
      await queryRunner.query(`DROP TABLE \`email_campaigns\``);
    }
  }
}
