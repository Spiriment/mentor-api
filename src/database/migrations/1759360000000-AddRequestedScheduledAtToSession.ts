import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddRequestedScheduledAtToSession1759360000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if column exists
    const columnExists = await queryRunner.query(
      `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'sessions' 
       AND COLUMN_NAME = 'requestedScheduledAt'`
    );

    // Add requestedScheduledAt column to sessions table (only if it doesn't exist)
    if (columnExists[0].count === 0) {
      await queryRunner.addColumn(
        'sessions',
        new TableColumn({
          name: 'requestedScheduledAt',
          type: 'datetime',
          isNullable: true,
        })
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove requestedScheduledAt column from sessions table
    await queryRunner.dropColumn('sessions', 'requestedScheduledAt');
  }
}
