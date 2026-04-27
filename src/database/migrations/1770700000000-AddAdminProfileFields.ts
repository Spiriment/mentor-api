import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdminProfileFields1770700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasFirstName = await queryRunner.hasColumn('admin_users', 'firstName');
    if (!hasFirstName) {
      await queryRunner.query(`
        ALTER TABLE \`admin_users\`
        ADD COLUMN \`firstName\` varchar(120) NULL
      `);
    }

    const hasLastName = await queryRunner.hasColumn('admin_users', 'lastName');
    if (!hasLastName) {
      await queryRunner.query(`
        ALTER TABLE \`admin_users\`
        ADD COLUMN \`lastName\` varchar(120) NULL
      `);
    }

    const hasAvatarUrl = await queryRunner.hasColumn('admin_users', 'avatarUrl');
    if (!hasAvatarUrl) {
      await queryRunner.query(`
        ALTER TABLE \`admin_users\`
        ADD COLUMN \`avatarUrl\` varchar(500) NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasAvatarUrl = await queryRunner.hasColumn('admin_users', 'avatarUrl');
    if (hasAvatarUrl) {
      await queryRunner.query(`
        ALTER TABLE \`admin_users\`
        DROP COLUMN \`avatarUrl\`
      `);
    }

    const hasLastName = await queryRunner.hasColumn('admin_users', 'lastName');
    if (hasLastName) {
      await queryRunner.query(`
        ALTER TABLE \`admin_users\`
        DROP COLUMN \`lastName\`
      `);
    }

    const hasFirstName = await queryRunner.hasColumn('admin_users', 'firstName');
    if (hasFirstName) {
      await queryRunner.query(`
        ALTER TABLE \`admin_users\`
        DROP COLUMN \`firstName\`
      `);
    }
  }
}
