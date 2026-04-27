import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMentorApprovalFields1765200000000 implements MigrationInterface {
  name = 'AddMentorApprovalFields1765200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasMentorApprovalStatus = await queryRunner.hasColumn(
      'users',
      'mentorApprovalStatus'
    );
    if (!hasMentorApprovalStatus) {
      await queryRunner.query(`
        ALTER TABLE \`users\`
        ADD COLUMN \`mentorApprovalStatus\` enum('pending', 'approved', 'rejected') NULL
      `);
    }

    const hasMentorApprovedAt = await queryRunner.hasColumn(
      'users',
      'mentorApprovedAt'
    );
    if (!hasMentorApprovedAt) {
      await queryRunner.query(`
        ALTER TABLE \`users\`
        ADD COLUMN \`mentorApprovedAt\` timestamp NULL
      `);
    }

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
    const hasMentorApprovedAt = await queryRunner.hasColumn(
      'users',
      'mentorApprovedAt'
    );
    if (hasMentorApprovedAt) {
      await queryRunner.query(`
        ALTER TABLE \`users\`
        DROP COLUMN \`mentorApprovedAt\`
      `);
    }

    const hasMentorApprovalStatus = await queryRunner.hasColumn(
      'users',
      'mentorApprovalStatus'
    );
    if (hasMentorApprovalStatus) {
      await queryRunner.query(`
        ALTER TABLE \`users\`
        DROP COLUMN \`mentorApprovalStatus\`
      `);
    }
  }
}
