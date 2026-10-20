import { MigrationInterface, QueryRunner } from 'typeorm';

/** Counts wrong pastor password-reset codes so a 6-digit code can't be brute-forced. */
export class AddChurchPortalUserResetAttempts1783410000000 implements MigrationInterface {
  name = 'AddChurchPortalUserResetAttempts1783410000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('church_portal_users', 'resetAttempts'))) {
      await queryRunner.query('ALTER TABLE `church_portal_users` ADD `resetAttempts` int NOT NULL DEFAULT 0');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('church_portal_users', 'resetAttempts')) {
      await queryRunner.query('ALTER TABLE `church_portal_users` DROP COLUMN `resetAttempts`');
    }
  }
}
