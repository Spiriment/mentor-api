import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChangeAppNotificationTypeToVarchar1765000000000
  implements MigrationInterface
{
  name = 'ChangeAppNotificationTypeToVarchar1765000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if app_notifications table exists
    const tableExists = await queryRunner.query(
      `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'app_notifications'`
    );

    if (tableExists[0].count === 0) {
      console.log('app_notifications table does not exist, skipping migration');
      return;
    }

    // Check current column type
    const columnInfo = await queryRunner.query(
      `SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'app_notifications' 
       AND COLUMN_NAME = 'type'`
    );

    if (columnInfo.length === 0) {
      console.log('type column does not exist in app_notifications table, skipping migration');
      return;
    }

    const currentType = columnInfo[0].COLUMN_TYPE;
    const isNullable = columnInfo[0].IS_NULLABLE === 'YES';
    // Get default value and ensure it's properly quoted
    let defaultValue = columnInfo[0].COLUMN_DEFAULT || 'system';
    // Remove existing quotes if present, then add proper quotes
    defaultValue = defaultValue.replace(/^'|'$/g, '');
    const quotedDefault = `'${defaultValue}'`;

    // Only alter if it's an enum type
    if (currentType.includes('enum')) {
      console.log(`Changing type column from ${currentType} to VARCHAR(50)`);
      
      // Alter the column to VARCHAR(50)
      await queryRunner.query(
        `ALTER TABLE \`app_notifications\` 
         MODIFY COLUMN \`type\` VARCHAR(50) ${isNullable ? 'NULL' : 'NOT NULL'} DEFAULT ${quotedDefault}`
      );
      
      console.log('Successfully changed app_notifications.type column to VARCHAR(50)');
    } else {
      console.log(`type column is already ${currentType}, no change needed`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Check if app_notifications table exists
    const tableExists = await queryRunner.query(
      `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'app_notifications'`
    );

    if (tableExists[0].count === 0) {
      console.log('app_notifications table does not exist, skipping rollback');
      return;
    }

    // Check current column type
    const columnInfo = await queryRunner.query(
      `SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'app_notifications' 
       AND COLUMN_NAME = 'type'`
    );

    if (columnInfo.length === 0) {
      console.log('type column does not exist, skipping rollback');
      return;
    }

    const currentType = columnInfo[0].COLUMN_TYPE;
    const isNullable = columnInfo[0].IS_NULLABLE === 'YES';
    // Get default value and ensure it's properly quoted
    let defaultValue = columnInfo[0].COLUMN_DEFAULT || 'system';
    // Remove existing quotes if present, then add proper quotes
    defaultValue = defaultValue.replace(/^'|'$/g, '');
    const quotedDefault = `'${defaultValue}'`;

    // Only revert if it's VARCHAR
    if (currentType.includes('varchar')) {
      console.log(`Reverting type column from ${currentType} back to ENUM`);
      
      // Revert to enum with all possible values
      // Note: This is a simplified enum - in production you might want to preserve the original enum values
      await queryRunner.query(
        `ALTER TABLE \`app_notifications\` 
         MODIFY COLUMN \`type\` ENUM(
           'mentorship_request',
           'mentorship_accepted',
           'mentorship_declined',
           'session_request',
           'session_confirmed',
           'session_rescheduled',
           'session_declined',
           'session_reminder',
           'session_review_submitted',
           'reschedule_request',
           'reschedule_accepted',
           'reschedule_declined',
           'group_session_invitation',
           'group_session_response',
           'group_session_reminder',
           'group_session_cancelled',
           'streak_reminder',
           'streak_milestone',
           'streak_freeze_awarded',
           'streak_freeze_used',
           'streak_broken',
           'message',
           'system'
         ) ${isNullable ? 'NULL' : 'NOT NULL'} DEFAULT ${quotedDefault}`
      );
      
      console.log('Successfully reverted app_notifications.type column to ENUM');
    } else {
      console.log(`type column is already ${currentType}, no rollback needed`);
    }
  }
}

