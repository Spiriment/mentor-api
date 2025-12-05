import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddReengagementFieldsToUser1733235000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add lastActiveAt column
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'lastActiveAt',
        type: 'datetime',
        isNullable: true,
      })
    );

    // Add lastReengagementEmailSentAt column
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'lastReengagementEmailSentAt',
        type: 'datetime',
        isNullable: true,
      })
    );

    // Add reengagementEmailsSent column
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'reengagementEmailsSent',
        type: 'json',
        isNullable: true,
      })
    );

    // Set lastActiveAt to current date for existing users
    await queryRunner.query(
      `UPDATE users SET lastActiveAt = NOW() WHERE lastActiveAt IS NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'reengagementEmailsSent');
    await queryRunner.dropColumn('users', 'lastReengagementEmailSentAt');
    await queryRunner.dropColumn('users', 'lastActiveAt');
  }
}
