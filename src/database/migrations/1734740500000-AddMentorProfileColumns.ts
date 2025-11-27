import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMentorProfileColumns1734740500000
  implements MigrationInterface
{
  name = 'AddMentorProfileColumns1734740500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Helper function to check if column exists
    const columnExists = async (tableName: string, columnName: string): Promise<boolean> => {
      const result = await queryRunner.query(
        `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = '${tableName}' 
         AND COLUMN_NAME = '${columnName}'`
      );
      return result[0].count > 0;
    };

    // Add columns only if they don't exist
    const columnsToAdd = [
      { name: 'christianExperience', type: 'varchar(255) NULL' },
      { name: 'christianJourney', type: 'text NULL' },
      { name: 'scriptureTeaching', type: 'varchar(255) NULL' },
      { name: 'currentMentoring', type: 'varchar(255) NULL' },
      { name: 'churchAffiliation', type: 'varchar(255) NULL' },
      { name: 'leadershipRoles', type: 'varchar(255) NULL' },
      { name: 'maturityDefinition', type: 'text NULL' },
      { name: 'menteeCapacity', type: 'varchar(255) NULL' },
      { name: 'mentorshipFormat', type: 'json NULL' },
      { name: 'menteeCalling', type: 'json NULL' },
      { name: 'videoIntroduction', type: 'varchar(255) NULL' },
      { name: 'profileImage', type: 'varchar(255) NULL' },
      { name: 'isOnboardingComplete', type: 'boolean DEFAULT false' },
      { name: 'onboardingStep', type: "varchar(255) DEFAULT 'christianExperience'" },
      { name: 'isApproved', type: 'boolean DEFAULT false' },
      { name: 'approvalNotes', type: 'text NULL' },
      { name: 'approvedAt', type: 'datetime NULL' },
    ];

    for (const column of columnsToAdd) {
      const exists = await columnExists('mentor_profiles', column.name);
      if (!exists) {
        await queryRunner.query(
          `ALTER TABLE \`mentor_profiles\` ADD COLUMN \`${column.name}\` ${column.type}`
        );
      }
    }
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
