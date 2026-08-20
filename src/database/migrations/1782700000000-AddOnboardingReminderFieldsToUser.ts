import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddOnboardingReminderFieldsToUser1782700000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasOnboardingReminderEmailsSent = await queryRunner.hasColumn(
      'users',
      'onboardingReminderEmailsSent',
    );
    if (!hasOnboardingReminderEmailsSent) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'onboardingReminderEmailsSent',
          type: 'json',
          isNullable: true,
        }),
      );
    }

    const hasLastOnboardingReminderEmailSentAt = await queryRunner.hasColumn(
      'users',
      'lastOnboardingReminderEmailSentAt',
    );
    if (!hasLastOnboardingReminderEmailSentAt) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'lastOnboardingReminderEmailSentAt',
          type: 'datetime',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasLastOnboardingReminderEmailSentAt = await queryRunner.hasColumn(
      'users',
      'lastOnboardingReminderEmailSentAt',
    );
    if (hasLastOnboardingReminderEmailSentAt) {
      await queryRunner.dropColumn('users', 'lastOnboardingReminderEmailSentAt');
    }

    const hasOnboardingReminderEmailsSent = await queryRunner.hasColumn(
      'users',
      'onboardingReminderEmailsSent',
    );
    if (hasOnboardingReminderEmailsSent) {
      await queryRunner.dropColumn('users', 'onboardingReminderEmailsSent');
    }
  }
}
