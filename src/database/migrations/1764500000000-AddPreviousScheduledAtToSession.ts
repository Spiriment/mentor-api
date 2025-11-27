import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';
import { logger } from '@/config/int-services';

export class AddPreviousScheduledAtToSession1764500000000
  implements MigrationInterface
{
  name = 'AddPreviousScheduledAtToSession1764500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if column exists
    const columnExists = await queryRunner.query(
      `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'sessions' 
       AND COLUMN_NAME = 'previousScheduledAt'`
    );

    // Add previousScheduledAt column to sessions table (only if it doesn't exist)
    if (columnExists[0].count === 0) {
      await queryRunner.addColumn(
        'sessions',
        new TableColumn({
          name: 'previousScheduledAt',
          type: 'datetime',
          isNullable: true,
        })
      );
      logger.info('Added previousScheduledAt column to sessions table');
    } else {
      logger.info('previousScheduledAt column already exists, skipping');
    }

    // Check and add rescheduleRequestedAt if it doesn't exist
    const rescheduleRequestedAtExists = await queryRunner.query(
      `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'sessions' 
       AND COLUMN_NAME = 'rescheduleRequestedAt'`
    );

    if (rescheduleRequestedAtExists[0].count === 0) {
      await queryRunner.addColumn(
        'sessions',
        new TableColumn({
          name: 'rescheduleRequestedAt',
          type: 'datetime',
          isNullable: true,
        })
      );
      logger.info('Added rescheduleRequestedAt column to sessions table');
    }

    // Check and add rescheduleReason if it doesn't exist
    const rescheduleReasonExists = await queryRunner.query(
      `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'sessions' 
       AND COLUMN_NAME = 'rescheduleReason'`
    );

    if (rescheduleReasonExists[0].count === 0) {
      await queryRunner.addColumn(
        'sessions',
        new TableColumn({
          name: 'rescheduleReason',
          type: 'text',
          isNullable: true,
        })
      );
      logger.info('Added rescheduleReason column to sessions table');
    }

    // Check and add rescheduleMessage if it doesn't exist
    const rescheduleMessageExists = await queryRunner.query(
      `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'sessions' 
       AND COLUMN_NAME = 'rescheduleMessage'`
    );

    if (rescheduleMessageExists[0].count === 0) {
      await queryRunner.addColumn(
        'sessions',
        new TableColumn({
          name: 'rescheduleMessage',
          type: 'text',
          isNullable: true,
        })
      );
      logger.info('Added rescheduleMessage column to sessions table');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove columns in reverse order
    const columns = [
      'rescheduleMessage',
      'rescheduleReason',
      'rescheduleRequestedAt',
      'previousScheduledAt',
    ];

    for (const columnName of columns) {
      const columnExists = await queryRunner.query(
        `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'sessions' 
         AND COLUMN_NAME = '${columnName}'`
      );

      if (columnExists[0].count > 0) {
        await queryRunner.dropColumn('sessions', columnName);
        logger.info(`Dropped ${columnName} column from sessions table`);
      }
    }
  }
}

