import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMentorApprovalFields1765200000000 implements MigrationInterface {
  name = 'AddMentorApprovalFields1765200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add mentorApprovalStatus column as enum
    await queryRunner.query(`
      ALTER TABLE \`users\`
      ADD COLUMN \`mentorApprovalStatus\` enum('pending', 'approved', 'rejected') NULL
    `);

    // Add mentorApprovedAt timestamp column
    await queryRunner.query(`
      ALTER TABLE \`users\`
      ADD COLUMN \`mentorApprovedAt\` timestamp NULL
    `);

    // For testing: Auto-approve existing mentors
    // Comment this out when switching to manual approval
    await queryRunner.query(`
      UPDATE \`users\`
      SET \`mentorApprovalStatus\` = 'approved',
          \`mentorApprovedAt\` = NOW()
      WHERE \`role\` = 'mentor' AND \`isOnboardingComplete\` = 1
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert: Remove the mentorApprovedAt column
    await queryRunner.query(`
      ALTER TABLE \`users\`
      DROP COLUMN \`mentorApprovedAt\`
    `);

    // Revert: Remove the mentorApprovalStatus column
    await queryRunner.query(`
      ALTER TABLE \`users\`
      DROP COLUMN \`mentorApprovalStatus\`
    `);
  }
}
