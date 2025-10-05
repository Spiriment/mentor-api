import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMentorProfileColumns1734740500000
  implements MigrationInterface
{
  name = 'AddMentorProfileColumns1734740500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add all missing columns to mentor_profiles table
    await queryRunner.query(`
            ALTER TABLE \`mentor_profiles\` 
            ADD COLUMN \`christianExperience\` varchar(255) NULL,
            ADD COLUMN \`christianJourney\` text NULL,
            ADD COLUMN \`scriptureTeaching\` varchar(255) NULL,
            ADD COLUMN \`currentMentoring\` varchar(255) NULL,
            ADD COLUMN \`churchAffiliation\` varchar(255) NULL,
            ADD COLUMN \`leadershipRoles\` varchar(255) NULL,
            ADD COLUMN \`maturityDefinition\` text NULL,
            ADD COLUMN \`menteeCapacity\` varchar(255) NULL,
            ADD COLUMN \`mentorshipFormat\` json NULL,
            ADD COLUMN \`menteeCalling\` json NULL,
            ADD COLUMN \`videoIntroduction\` varchar(255) NULL,
            ADD COLUMN \`profileImage\` varchar(255) NULL,
            ADD COLUMN \`isOnboardingComplete\` boolean DEFAULT false,
            ADD COLUMN \`onboardingStep\` varchar(255) DEFAULT 'christianExperience',
            ADD COLUMN \`isApproved\` boolean DEFAULT false,
            ADD COLUMN \`approvalNotes\` text NULL,
            ADD COLUMN \`approvedAt\` datetime NULL
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove all the added columns
    await queryRunner.query(`
            ALTER TABLE \`mentor_profiles\` 
            DROP COLUMN \`christianExperience\`,
            DROP COLUMN \`christianJourney\`,
            DROP COLUMN \`scriptureTeaching\`,
            DROP COLUMN \`currentMentoring\`,
            DROP COLUMN \`churchAffiliation\`,
            DROP COLUMN \`leadershipRoles\`,
            DROP COLUMN \`maturityDefinition\`,
            DROP COLUMN \`menteeCapacity\`,
            DROP COLUMN \`mentorshipFormat\`,
            DROP COLUMN \`menteeCalling\`,
            DROP COLUMN \`videoIntroduction\`,
            DROP COLUMN \`profileImage\`,
            DROP COLUMN \`isOnboardingComplete\`,
            DROP COLUMN \`onboardingStep\`,
            DROP COLUMN \`isApproved\`,
            DROP COLUMN \`approvalNotes\`,
            DROP COLUMN \`approvedAt\`
        `);
  }
}
