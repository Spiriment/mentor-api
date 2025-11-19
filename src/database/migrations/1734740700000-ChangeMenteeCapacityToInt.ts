import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChangeMenteeCapacityToInt1734740700000
  implements MigrationInterface
{
  name = 'ChangeMenteeCapacityToInt1734740700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Change menteeCapacity from varchar(255) to int
    // First, we need to handle existing data - convert string values to integers
    // If the value is not a valid number, set it to NULL
    await queryRunner.query(`
      UPDATE \`mentor_profiles\` 
      SET \`menteeCapacity\` = NULL 
      WHERE \`menteeCapacity\` IS NOT NULL 
      AND (\`menteeCapacity\` = '' OR \`menteeCapacity\` NOT REGEXP '^[0-9]+$')
    `);

    // Now change the column type
    await queryRunner.query(`
      ALTER TABLE \`mentor_profiles\` 
      MODIFY COLUMN \`menteeCapacity\` int NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert back to varchar(255)
    await queryRunner.query(`
      ALTER TABLE \`mentor_profiles\` 
      MODIFY COLUMN \`menteeCapacity\` varchar(255) NULL
    `);
  }
}
