import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateScheduledNotifications1767367147720 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'scheduled_notifications',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'pushToken',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'enum',
            enum: ['welcome', 'session_reminder', 'message', 'other'],
            default: "'other'",
            isNullable: false,
          },
          {
            name: 'title',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'body',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'data',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'scheduledFor',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'sent', 'failed', 'cancelled'],
            default: "'pending'",
            isNullable: false,
          },
          {
            name: 'sentAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'errorMessage',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'retryCount',
            type: 'int',
            default: 0,
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
      true
    );

    // Create indexes for better query performance
    await queryRunner.createIndex(
      'scheduled_notifications',
      new TableIndex({
        name: 'IDX_scheduled_notifications_scheduledFor_status',
        columnNames: ['scheduledFor', 'status'],
      })
    );

    await queryRunner.createIndex(
      'scheduled_notifications',
      new TableIndex({
        name: 'IDX_scheduled_notifications_userId_status',
        columnNames: ['userId', 'status'],
      })
    );

    await queryRunner.createIndex(
      'scheduled_notifications',
      new TableIndex({
        name: 'IDX_scheduled_notifications_userId',
        columnNames: ['userId'],
      })
    );

    await queryRunner.createIndex(
      'scheduled_notifications',
      new TableIndex({
        name: 'IDX_scheduled_notifications_scheduledFor',
        columnNames: ['scheduledFor'],
      })
    );

    await queryRunner.createIndex(
      'scheduled_notifications',
      new TableIndex({
        name: 'IDX_scheduled_notifications_status',
        columnNames: ['status'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('scheduled_notifications');
  }
}
