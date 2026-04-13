import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase4SubscriptionsPlansSettings1770600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`spiriment_settings\` (
        \`id\` varchar(64) NOT NULL,
        \`data\` json NOT NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      INSERT INTO \`spiriment_settings\` (\`id\`, \`data\`) VALUES (
        'global',
        '{"supportEmail":"support@spiriment.com","publicAppName":"Spiriment","maintenanceMode":false,"features":{"mentorApplications":true,"groupSessions":true}}'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE \`org_plans\` (
        \`id\` varchar(36) NOT NULL,
        \`planType\` varchar(16) NOT NULL,
        \`name\` varchar(255) NOT NULL,
        \`status\` varchar(24) NOT NULL DEFAULT 'active',
        \`totalSeats\` int NOT NULL DEFAULT 0,
        \`usedSeats\` int NOT NULL DEFAULT 0,
        \`billingAdminUserId\` varchar(36) NULL,
        \`metadata\` json NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX \`IDX_org_plans_planType_status\` (\`planType\`, \`status\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE \`user_subscriptions\` (
        \`id\` varchar(36) NOT NULL,
        \`userId\` varchar(36) NOT NULL,
        \`tier\` varchar(24) NOT NULL,
        \`status\` varchar(24) NOT NULL DEFAULT 'active',
        \`mrrCents\` int NULL,
        \`currency\` varchar(8) NOT NULL DEFAULT 'USD',
        \`expiresAt\` datetime(6) NULL,
        \`externalProvider\` varchar(64) NULL,
        \`externalRef\` varchar(255) NULL,
        \`notes\` varchar(500) NULL,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`UQ_user_subscriptions_userId\` (\`userId\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`user_subscriptions\``);
    await queryRunner.query(`DROP TABLE \`org_plans\``);
    await queryRunner.query(`DROP TABLE \`spiriment_settings\``);
  }
}
