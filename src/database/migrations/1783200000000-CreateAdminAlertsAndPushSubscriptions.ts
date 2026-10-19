import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class CreateAdminAlertsAndPushSubscriptions1783200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('admin_alerts'))) {
      await queryRunner.query(`
        CREATE TABLE \`admin_alerts\` (
          \`id\` varchar(36) NOT NULL,
          \`adminUserId\` varchar(36) NOT NULL,
          \`type\` varchar(32) NOT NULL,
          \`title\` varchar(200) NOT NULL,
          \`body\` varchar(500) NOT NULL,
          \`link\` varchar(255) NULL,
          \`readAt\` datetime NULL,
          \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          INDEX \`IDX_admin_alerts_admin_read\` (\`adminUserId\`, \`readAt\`),
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB
      `);
    }

    if (!(await queryRunner.hasTable('admin_push_subscriptions'))) {
      await queryRunner.query(`
        CREATE TABLE \`admin_push_subscriptions\` (
          \`id\` varchar(36) NOT NULL,
          \`adminUserId\` varchar(36) NOT NULL,
          \`endpoint\` varchar(500) NOT NULL,
          \`p256dh\` varchar(255) NOT NULL,
          \`auth\` varchar(255) NOT NULL,
          \`userAgent\` varchar(255) NULL,
          \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          INDEX \`IDX_admin_push_subscriptions_admin\` (\`adminUserId\`),
          UNIQUE INDEX \`UQ_admin_push_subscriptions_endpoint\` (\`endpoint\`),
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB
      `);
    }

    if (!(await queryRunner.hasColumn('admin_users', 'notificationPreferences'))) {
      await queryRunner.addColumn(
        'admin_users',
        new TableColumn({ name: 'notificationPreferences', type: 'json', isNullable: true }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('admin_users', 'notificationPreferences')) {
      await queryRunner.dropColumn('admin_users', 'notificationPreferences');
    }
    if (await queryRunner.hasTable('admin_push_subscriptions')) {
      await queryRunner.query('DROP TABLE `admin_push_subscriptions`');
    }
    if (await queryRunner.hasTable('admin_alerts')) {
      await queryRunner.query('DROP TABLE `admin_alerts`');
    }
  }
}
