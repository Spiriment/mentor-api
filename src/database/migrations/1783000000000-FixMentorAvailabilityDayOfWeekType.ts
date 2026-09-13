import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The `MentorAvailability.dayOfWeek` entity column was changed from a MySQL
 * `enum('0'..'6')` to a plain `int`, but no migration ever ran to convert the
 * live column — every availability save has been failing with a DB-level
 * error since. A bare `MODIFY COLUMN ... int` would corrupt existing data:
 * MySQL casts an enum to int using its 1-based *positional* index, not the
 * enum's string value, so `'0'` (index 1) would become `1`, `'1'` (index 2)
 * would become `2`, etc. Cast to a string column first so the numeric
 * *value* is preserved, then convert that to int.
 */
export class FixMentorAvailabilityDayOfWeekType1783000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('mentor_availability');
    const column = table?.findColumnByName('dayOfWeek');
    if (!column || column.type === 'int') return;

    await queryRunner.query(
      `ALTER TABLE \`mentor_availability\` MODIFY \`dayOfWeek\` varchar(1) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`mentor_availability\` MODIFY \`dayOfWeek\` int NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('mentor_availability');
    const column = table?.findColumnByName('dayOfWeek');
    if (!column || column.type !== 'int') return;

    await queryRunner.query(
      `ALTER TABLE \`mentor_availability\` MODIFY \`dayOfWeek\` enum('0','1','2','3','4','5','6') NOT NULL`,
    );
  }
}
