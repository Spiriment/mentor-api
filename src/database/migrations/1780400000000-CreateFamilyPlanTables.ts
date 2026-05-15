import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFamilyPlanTables1780400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE family_plans (
        id         VARCHAR(36)  NOT NULL PRIMARY KEY,
        name       VARCHAR(255) NOT NULL,
        status     VARCHAR(16)  NOT NULL DEFAULT 'active',
        parentUserId VARCHAR(36) NOT NULL,
        createdAt  DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt  DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        CONSTRAINT fk_fp_parent FOREIGN KEY (parentUserId) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE family_members (
        id                   VARCHAR(36)  NOT NULL PRIMARY KEY,
        familyPlanId         VARCHAR(36)  NOT NULL,
        userId               VARCHAR(36)  NOT NULL,
        tier                 VARCHAR(24)  NOT NULL DEFAULT 'basic',
        ageDiscountPercent   INT          NOT NULL DEFAULT 0,
        stripeSubscriptionId VARCHAR(255) NULL,
        isParent             TINYINT(1)   NOT NULL DEFAULT 0,
        createdAt            DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt            DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        CONSTRAINT fk_fm_plan FOREIGN KEY (familyPlanId) REFERENCES family_plans(id) ON DELETE CASCADE,
        CONSTRAINT fk_fm_user FOREIGN KEY (userId)       REFERENCES users(id)        ON DELETE CASCADE,
        UNIQUE KEY uq_fm_user (userId)
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS family_members`);
    await queryRunner.query(`DROP TABLE IF EXISTS family_plans`);
  }
}
