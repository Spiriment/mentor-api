import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTimezoneColumnsSafely1764000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if timezone column exists, if not add it
    const timezoneExists = await queryRunner.query(
      `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'users' 
       AND COLUMN_NAME = 'timezone'`
    );

    if (timezoneExists[0].count === 0) {
      await queryRunner.query(
        `ALTER TABLE \`users\` ADD \`timezone\` varchar(255) NOT NULL DEFAULT 'UTC'`
      );
    }

    // Check if streakFreezeCount column exists, if not add it
    const freezeCountExists = await queryRunner.query(
      `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'users' 
       AND COLUMN_NAME = 'streakFreezeCount'`
    );

    if (freezeCountExists[0].count === 0) {
      await queryRunner.query(
        `ALTER TABLE \`users\` ADD \`streakFreezeCount\` int NOT NULL DEFAULT 0`
      );
    }

    // Check if monthlyStreakData column exists, if not add it
    const monthlyDataExists = await queryRunner.query(
      `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'users' 
       AND COLUMN_NAME = 'monthlyStreakData'`
    );

    if (monthlyDataExists[0].count === 0) {
      await queryRunner.query(
        `ALTER TABLE \`users\` ADD \`monthlyStreakData\` json NULL`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove columns if they exist
    const timezoneExists = await queryRunner.query(
      `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'users' 
       AND COLUMN_NAME = 'timezone'`
    );

    if (timezoneExists[0].count > 0) {
      await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`timezone\``);
    }

    const freezeCountExists = await queryRunner.query(
      `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'users' 
       AND COLUMN_NAME = 'streakFreezeCount'`
    );

    if (freezeCountExists[0].count > 0) {
      await queryRunner.query(
        `ALTER TABLE \`users\` DROP COLUMN \`streakFreezeCount\``
      );
    }

    const monthlyDataExists = await queryRunner.query(
      `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'users' 
       AND COLUMN_NAME = 'monthlyStreakData'`
    );

    if (monthlyDataExists[0].count > 0) {
      await queryRunner.query(
        `ALTER TABLE \`users\` DROP COLUMN \`monthlyStreakData\``
      );
    }
  }
}

