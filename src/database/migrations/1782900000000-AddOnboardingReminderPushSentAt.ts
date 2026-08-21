import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddOnboardingReminderPushSentAt1782900000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn(
      'users',
      'onboardingReminderPushSentAt',
    );
    if (!hasColumn) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'onboardingReminderPushSentAt',
          type: 'datetime',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn(
      'users',
      'onboardingReminderPushSentAt',
    );
    if (hasColumn) {
      await queryRunner.dropColumn('users', 'onboardingReminderPushSentAt');
    }
  }
}
