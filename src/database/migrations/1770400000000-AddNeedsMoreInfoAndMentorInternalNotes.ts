import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNeedsMoreInfoAndMentorInternalNotes1770400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`users\`
      MODIFY COLUMN \`mentorApprovalStatus\` enum('pending', 'approved', 'rejected', 'needs_more_info') NULL
    `);

    await queryRunner.query(`
      ALTER TABLE \`mentor_profiles\`
      ADD COLUMN \`internalAdminNotes\` json NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`mentor_profiles\` DROP COLUMN \`internalAdminNotes\`
    `);

    await queryRunner.query(`
      UPDATE \`users\` SET \`mentorApprovalStatus\` = 'pending' WHERE \`mentorApprovalStatus\` = 'needs_more_info'
    `);

    await queryRunner.query(`
      ALTER TABLE \`users\`
      MODIFY COLUMN \`mentorApprovalStatus\` enum('pending', 'approved', 'rejected') NULL
    `);
  }
}
