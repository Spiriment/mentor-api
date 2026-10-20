import { MigrationInterface, QueryRunner } from 'typeorm';

/** Per-admin permission grants (see common/adminPermissions.ts). NULL = no extra permissions. */
export class AddAdminUserPermissions1783400000000 implements MigrationInterface {
  name = 'AddAdminUserPermissions1783400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('admin_users', 'permissions'))) {
      await queryRunner.query('ALTER TABLE `admin_users` ADD `permissions` json NULL');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('admin_users', 'permissions')) {
      await queryRunner.query('ALTER TABLE `admin_users` DROP COLUMN `permissions`');
    }
  }
}
