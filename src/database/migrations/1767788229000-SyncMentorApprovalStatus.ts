import { MigrationInterface, QueryRunner } from 'typeorm';

export class SyncMentorApprovalStatus1767788229000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Sync mentorApprovalStatus in User table with isApproved in MentorProfile table
    // This fixes any cases where a mentor was approved but their User.mentorApprovalStatus wasn't updated
    await queryRunner.query(`
      UPDATE users u
      INNER JOIN mentor_profiles mp ON u.id = mp.userId
      SET u.mentorApprovalStatus = 'approved',
          u.mentorApprovedAt = mp.approvedAt
      WHERE u.role = 'mentor'
        AND mp.isApproved = 1
        AND (u.mentorApprovalStatus IS NULL OR u.mentorApprovalStatus != 'approved')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No down migration - we don't want to un-approve mentors
  }
}
