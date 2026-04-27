import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddReengagementFieldsToUser1733235000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasLastActiveAt = await queryRunner.hasColumn('users', 'lastActiveAt');
    if (!hasLastActiveAt) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'lastActiveAt',
          type: 'datetime',
          isNullable: true,
        })
      );
    }

    const hasLastReengagementEmailSentAt = await queryRunner.hasColumn(
      'users',
      'lastReengagementEmailSentAt'
    );
    if (!hasLastReengagementEmailSentAt) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'lastReengagementEmailSentAt',
          type: 'datetime',
          isNullable: true,
        })
      );
    }

    const hasReengagementEmailsSent = await queryRunner.hasColumn(
      'users',
      'reengagementEmailsSent'
    );
    if (!hasReengagementEmailsSent) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'reengagementEmailsSent',
          type: 'json',
          isNullable: true,
        })
      );
    }

    // Set lastActiveAt to current date for existing users
    await queryRunner.query(
      `UPDATE users SET lastActiveAt = NOW() WHERE lastActiveAt IS NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasReengagementEmailsSent = await queryRunner.hasColumn(
      'users',
      'reengagementEmailsSent'
    );
    if (hasReengagementEmailsSent) {
      await queryRunner.dropColumn('users', 'reengagementEmailsSent');
    }

    const hasLastReengagementEmailSentAt = await queryRunner.hasColumn(
      'users',
      'lastReengagementEmailSentAt'
    );
    if (hasLastReengagementEmailSentAt) {
      await queryRunner.dropColumn('users', 'lastReengagementEmailSentAt');
    }

    const hasLastActiveAt = await queryRunner.hasColumn('users', 'lastActiveAt');
    if (hasLastActiveAt) {
      await queryRunner.dropColumn('users', 'lastActiveAt');
    }
  }
}
