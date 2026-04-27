import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStudyProgressToMentorProfile1733234600000
  implements MigrationInterface
{
  name = 'AddStudyProgressToMentorProfile1733234600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasCurrentBook = await queryRunner.hasColumn(
      'mentor_profiles',
      'currentBook'
    );
    if (!hasCurrentBook) {
      await queryRunner.query(`
        ALTER TABLE \`mentor_profiles\`
        ADD COLUMN \`currentBook\` varchar(255) NULL AFTER \`approvedAt\`
      `);
    }

    const hasCurrentChapter = await queryRunner.hasColumn(
      'mentor_profiles',
      'currentChapter'
    );
    if (!hasCurrentChapter) {
      await queryRunner.query(`
        ALTER TABLE \`mentor_profiles\`
        ADD COLUMN \`currentChapter\` int NOT NULL DEFAULT 1 AFTER \`currentBook\`
      `);
    }

    const hasCompletedChapters = await queryRunner.hasColumn(
      'mentor_profiles',
      'completedChapters'
    );
    if (!hasCompletedChapters) {
      await queryRunner.query(`
        ALTER TABLE \`mentor_profiles\`
        ADD COLUMN \`completedChapters\` json NULL AFTER \`currentChapter\`
      `);
    }

    const hasStudyDays = await queryRunner.hasColumn(
      'mentor_profiles',
      'studyDays'
    );
    if (!hasStudyDays) {
      await queryRunner.query(`
        ALTER TABLE \`mentor_profiles\`
        ADD COLUMN \`studyDays\` int NOT NULL DEFAULT 0 AFTER \`completedChapters\`
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasStudyDays = await queryRunner.hasColumn('mentor_profiles', 'studyDays');
    if (hasStudyDays) {
      await queryRunner.query(`
        ALTER TABLE \`mentor_profiles\`
        DROP COLUMN \`studyDays\`
      `);
    }

    const hasCompletedChapters = await queryRunner.hasColumn(
      'mentor_profiles',
      'completedChapters'
    );
    if (hasCompletedChapters) {
      await queryRunner.query(`
        ALTER TABLE \`mentor_profiles\`
        DROP COLUMN \`completedChapters\`
      `);
    }

    const hasCurrentChapter = await queryRunner.hasColumn(
      'mentor_profiles',
      'currentChapter'
    );
    if (hasCurrentChapter) {
      await queryRunner.query(`
        ALTER TABLE \`mentor_profiles\`
        DROP COLUMN \`currentChapter\`
      `);
    }

    const hasCurrentBook = await queryRunner.hasColumn(
      'mentor_profiles',
      'currentBook'
    );
    if (hasCurrentBook) {
      await queryRunner.query(`
        ALTER TABLE \`mentor_profiles\`
        DROP COLUMN \`currentBook\`
      `);
    }
  }
}
