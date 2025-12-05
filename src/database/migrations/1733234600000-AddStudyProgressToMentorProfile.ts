import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStudyProgressToMentorProfile1733234600000
  implements MigrationInterface
{
  name = 'AddStudyProgressToMentorProfile1733234600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add study progress columns to mentor_profiles table
    await queryRunner.query(`
      ALTER TABLE \`mentor_profiles\`
      ADD COLUMN \`currentBook\` varchar(255) NULL AFTER \`approvedAt\`
    `);

    await queryRunner.query(`
      ALTER TABLE \`mentor_profiles\`
      ADD COLUMN \`currentChapter\` int NOT NULL DEFAULT 1 AFTER \`currentBook\`
    `);

    await queryRunner.query(`
      ALTER TABLE \`mentor_profiles\`
      ADD COLUMN \`completedChapters\` json NULL AFTER \`currentChapter\`
    `);

    await queryRunner.query(`
      ALTER TABLE \`mentor_profiles\`
      ADD COLUMN \`studyDays\` int NOT NULL DEFAULT 0 AFTER \`completedChapters\`
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert: Remove the study progress columns
    await queryRunner.query(`
      ALTER TABLE \`mentor_profiles\`
      DROP COLUMN \`studyDays\`
    `);

    await queryRunner.query(`
      ALTER TABLE \`mentor_profiles\`
      DROP COLUMN \`completedChapters\`
    `);

    await queryRunner.query(`
      ALTER TABLE \`mentor_profiles\`
      DROP COLUMN \`currentChapter\`
    `);

    await queryRunner.query(`
      ALTER TABLE \`mentor_profiles\`
      DROP COLUMN \`currentBook\`
    `);
  }
}
