import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMentorAppFieldsToUser1734740400000
  implements MigrationInterface
{
  name = 'AddMentorAppFieldsToUser1734740400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`role\` enum ('mentee', 'mentor') NULL`
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`country\` varchar(255) NULL`
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`countryCode\` varchar(255) NULL`
    );
    await queryRunner.query(`ALTER TABLE \`users\` ADD \`birthday\` date NULL`);
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`isOnboardingComplete\` tinyint NOT NULL DEFAULT 0`
    );
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
