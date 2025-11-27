import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMentorAppFieldsToUser1734740400000
  implements MigrationInterface
{
  name = 'AddMentorAppFieldsToUser1734740400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if role column exists, if not add it
    const roleExists = await queryRunner.query(
      `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'users' 
       AND COLUMN_NAME = 'role'`
    );
    if (roleExists[0].count === 0) {
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`role\` enum ('mentee', 'mentor') NULL`
    );
    }

    // Check if country column exists, if not add it
    const countryExists = await queryRunner.query(
      `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'users' 
       AND COLUMN_NAME = 'country'`
    );
    if (countryExists[0].count === 0) {
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`country\` varchar(255) NULL`
    );
    }

    // Check if countryCode column exists, if not add it
    const countryCodeExists = await queryRunner.query(
      `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'users' 
       AND COLUMN_NAME = 'countryCode'`
    );
    if (countryCodeExists[0].count === 0) {
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`countryCode\` varchar(255) NULL`
    );
    }

    // Check if birthday column exists, if not add it
    const birthdayExists = await queryRunner.query(
      `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'users' 
       AND COLUMN_NAME = 'birthday'`
    );
    if (birthdayExists[0].count === 0) {
    await queryRunner.query(`ALTER TABLE \`users\` ADD \`birthday\` date NULL`);
    }

    // Check if isOnboardingComplete column exists, if not add it
    const onboardingExists = await queryRunner.query(
      `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'users' 
       AND COLUMN_NAME = 'isOnboardingComplete'`
    );
    if (onboardingExists[0].count === 0) {
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`isOnboardingComplete\` tinyint NOT NULL DEFAULT 0`
    );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP COLUMN \`isOnboardingComplete\``
    );
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`birthday\``);
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP COLUMN \`countryCode\``
    );
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`country\``);
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`role\``);
  }
}
