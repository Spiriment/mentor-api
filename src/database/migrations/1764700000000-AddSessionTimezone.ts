import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddSessionTimezone1764700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if timezone column already exists
    const table = await queryRunner.getTable('sessions');
    const timezoneColumn = table?.findColumnByName('timezone');

    if (!timezoneColumn) {
      await queryRunner.addColumn(
        'sessions',
        new TableColumn({
          name: 'timezone',
          type: 'varchar',
          length: '100',
          default: "'UTC'",
        })
      );
      console.log('Added timezone column to sessions table');
    } else {
      console.log('Timezone column already exists in sessions table');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('sessions');
    const timezoneColumn = table?.findColumnByName('timezone');

    if (timezoneColumn) {
      await queryRunner.dropColumn('sessions', 'timezone');
      console.log('Dropped timezone column from sessions table');
    }
  }
}
