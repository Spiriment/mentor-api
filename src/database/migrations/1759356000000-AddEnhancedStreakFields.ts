import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEnhancedStreakFields1759356000000
  implements MigrationInterface
{
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

    // Add timezone field (only if it doesn't exist)
    if (!(await columnExists('users', 'timezone'))) {
      await queryRunner.query(
        `ALTER TABLE \`users\` ADD \`timezone\` varchar(255) NOT NULL DEFAULT 'UTC'`
      );
    }

    // Add streak freeze count (only if it doesn't exist)
    if (!(await columnExists('users', 'streakFreezeCount'))) {
      await queryRunner.query(
        `ALTER TABLE \`users\` ADD \`streakFreezeCount\` int NOT NULL DEFAULT 0`
      );
    }

    // Add monthly streak data (only if it doesn't exist)
    if (!(await columnExists('users', 'monthlyStreakData'))) {
      await queryRunner.query(
        `ALTER TABLE \`users\` ADD \`monthlyStreakData\` json NULL`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove enhanced streak fields
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP COLUMN \`monthlyStreakData\``
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP COLUMN \`streakFreezeCount\``
    );
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`timezone\``);
  }
}
