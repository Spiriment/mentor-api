import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateChurchPortalTables1780000000000 implements MigrationInterface {
  name = 'CreateChurchPortalTables1780000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`church_portals\` (
        \`id\`           VARCHAR(36)   NOT NULL,
        \`orgPlanId\`    VARCHAR(36)   NULL,
        \`name\`         VARCHAR(255)  NOT NULL,
        \`slug\`         VARCHAR(100)  NOT NULL,
        \`logoUrl\`      VARCHAR(500)  NULL,
        \`denomination\` VARCHAR(100)  NULL,
        \`city\`         VARCHAR(100)  NULL,
        \`country\`      VARCHAR(100)  NULL,
        \`timezone\`     VARCHAR(64)   NOT NULL DEFAULT 'UTC',
        \`status\`       VARCHAR(24)   NOT NULL DEFAULT 'active',
        \`metadata\`     JSON          NULL,
        \`createdAt\`    DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\`    DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`IDX_church_portals_slug\` (\`slug\`),
        INDEX \`IDX_church_portals_orgPlanId\` (\`orgPlanId\`)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE \`church_portal_users\` (
        \`id\`                   VARCHAR(36)   NOT NULL,
        \`churchPortalId\`       VARCHAR(36)   NOT NULL,
        \`email\`                VARCHAR(255)  NOT NULL,
        \`password\`             VARCHAR(255)  NULL,
        \`firstName\`            VARCHAR(120)  NULL,
        \`lastName\`             VARCHAR(120)  NULL,
        \`role\`                 VARCHAR(32)   NOT NULL DEFAULT 'pastor',
        \`isActive\`             TINYINT(1)    NOT NULL DEFAULT 1,
        \`lastLoginAt\`          DATETIME(6)   NULL,
        \`inviteToken\`          VARCHAR(255)  NULL,
        \`inviteTokenExpiresAt\` DATETIME(6)   NULL,
        \`createdAt\`            DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\`            DATETIME(6)   NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`UQ_church_portal_users_email\` (\`email\`),
        INDEX \`IDX_cpu_churchPortalId\` (\`churchPortalId\`)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE \`church_portal_refresh_tokens\` (
        \`id\`                   VARCHAR(36)  NOT NULL,
        \`churchPortalUserId\`   VARCHAR(36)  NOT NULL,
        \`token\`                TEXT         NOT NULL,
        \`expiresAt\`            DATETIME(6)  NOT NULL,
        \`createdAt\`            DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updatedAt\`            DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_cprt_churchPortalUserId\` (\`churchPortalUserId\`)
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`church_portal_refresh_tokens\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`church_portal_users\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`church_portals\``);
  }
}
