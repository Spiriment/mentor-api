import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';
import { logger } from '@/config/int-services';

export class CreateGroupSessions1764600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if group_sessions table already exists
    const groupSessionsTableExists = await queryRunner.query(
      `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'group_sessions'`
    );

    if (groupSessionsTableExists[0].count === 0) {
      // Create group_sessions table
      await queryRunner.createTable(
        new Table({
          name: 'group_sessions',
          columns: [
            {
              name: 'id',
              type: 'varchar',
              length: '36',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'uuid',
            },
            {
              name: 'mentorId',
              type: 'varchar',
              length: '36',
            },
            {
              name: 'title',
              type: 'varchar',
              length: '255',
            },
            {
              name: 'description',
              type: 'text',
              isNullable: true,
            },
            {
              name: 'scheduledAt',
              type: 'datetime',
            },
            {
              name: 'duration',
              type: 'enum',
              enum: ['30', '60', '90', '120'],
              default: "'60'",
            },
            {
              name: 'maxParticipants',
              type: 'int',
              default: 5,
            },
            {
              name: 'status',
              type: 'enum',
              enum: ['draft', 'invites_sent', 'confirmed', 'in_progress', 'completed', 'cancelled'],
              default: "'draft'",
            },
            {
              name: 'meetingLink',
              type: 'text',
              isNullable: true,
            },
            {
              name: 'meetingId',
              type: 'text',
              isNullable: true,
            },
            {
              name: 'meetingPassword',
              type: 'text',
              isNullable: true,
            },
            {
              name: 'startedAt',
              type: 'datetime',
              isNullable: true,
            },
            {
              name: 'endedAt',
              type: 'datetime',
              isNullable: true,
            },
            {
              name: 'cancelledAt',
              type: 'datetime',
              isNullable: true,
            },
            {
              name: 'cancellationReason',
              type: 'text',
              isNullable: true,
            },
            {
              name: 'reminders',
              type: 'json',
              isNullable: true,
            },
            {
              name: 'createdAt',
              type: 'datetime',
              default: 'CURRENT_TIMESTAMP',
            },
            {
              name: 'updatedAt',
              type: 'datetime',
              default: 'CURRENT_TIMESTAMP',
              onUpdate: 'CURRENT_TIMESTAMP',
            },
          ],
        }),
        true
      );

      // Create indexes
      await queryRunner.createIndex(
        'group_sessions',
        new TableIndex({
          name: 'IDX_group_sessions_mentorId',
          columnNames: ['mentorId'],
        })
      );

      await queryRunner.createIndex(
        'group_sessions',
        new TableIndex({
          name: 'IDX_group_sessions_scheduledAt',
          columnNames: ['scheduledAt'],
        })
      );

      // Create foreign key
      await queryRunner.createForeignKey(
        'group_sessions',
        new TableForeignKey({
          columnNames: ['mentorId'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        })
      );

      logger.info('group_sessions table created successfully');
    } else {
      logger.info('group_sessions table already exists, skipping creation');
    }

    // Check if group_session_participants table already exists
    const participantsTableExists = await queryRunner.query(
      `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'group_session_participants'`
    );

    if (participantsTableExists[0].count === 0) {
      // Create group_session_participants table
      await queryRunner.createTable(
        new Table({
          name: 'group_session_participants',
          columns: [
            {
              name: 'id',
              type: 'varchar',
              length: '36',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'uuid',
            },
            {
              name: 'groupSessionId',
              type: 'varchar',
              length: '36',
            },
            {
              name: 'menteeId',
              type: 'varchar',
              length: '36',
            },
            {
              name: 'invitationStatus',
              type: 'enum',
              enum: ['invited', 'accepted', 'declined', 'no_response'],
              default: "'invited'",
            },
            {
              name: 'invitedAt',
              type: 'datetime',
            },
            {
              name: 'respondedAt',
              type: 'datetime',
              isNullable: true,
            },
            {
              name: 'declineReason',
              type: 'text',
              isNullable: true,
            },
            {
              name: 'sessionSummary',
              type: 'text',
              isNullable: true,
            },
            {
              name: 'summarySubmittedAt',
              type: 'datetime',
              isNullable: true,
            },
            {
              name: 'hasSubmittedReview',
              type: 'boolean',
              default: false,
            },
            {
              name: 'createdAt',
              type: 'datetime',
              default: 'CURRENT_TIMESTAMP',
            },
            {
              name: 'updatedAt',
              type: 'datetime',
              default: 'CURRENT_TIMESTAMP',
              onUpdate: 'CURRENT_TIMESTAMP',
            },
          ],
        }),
        true
      );

      // Create unique index
      await queryRunner.createIndex(
        'group_session_participants',
        new TableIndex({
          name: 'IDX_group_session_participants_unique',
          columnNames: ['groupSessionId', 'menteeId'],
          isUnique: true,
        })
      );

      // Create indexes
      await queryRunner.createIndex(
        'group_session_participants',
        new TableIndex({
          name: 'IDX_group_session_participants_groupSessionId',
          columnNames: ['groupSessionId'],
        })
      );

      await queryRunner.createIndex(
        'group_session_participants',
        new TableIndex({
          name: 'IDX_group_session_participants_menteeId',
          columnNames: ['menteeId'],
        })
      );

      // Create foreign keys
      await queryRunner.createForeignKey(
        'group_session_participants',
        new TableForeignKey({
          columnNames: ['groupSessionId'],
          referencedTableName: 'group_sessions',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        })
      );

      await queryRunner.createForeignKey(
        'group_session_participants',
        new TableForeignKey({
          columnNames: ['menteeId'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        })
      );

      logger.info('group_session_participants table created successfully');
    } else {
      logger.info('group_session_participants table already exists, skipping creation');
    }

    // Add groupSessionId column to session_reviews table if it doesn't exist
    const columnExists = await queryRunner.query(
      `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'session_reviews'
       AND COLUMN_NAME = 'groupSessionId'`
    );

    if (columnExists[0].count === 0) {
      await queryRunner.query(`
        ALTER TABLE session_reviews
        ADD COLUMN groupSessionId VARCHAR(36) NULL AFTER sessionId
      `);

      // Make sessionId nullable (both sessionId and groupSessionId can't be null, but one can be)
      await queryRunner.query(`
        ALTER TABLE session_reviews
        MODIFY COLUMN sessionId VARCHAR(36) NULL
      `);

      // Create foreign key for groupSessionId
      await queryRunner.createForeignKey(
        'session_reviews',
        new TableForeignKey({
          columnNames: ['groupSessionId'],
          referencedTableName: 'group_sessions',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        })
      );

      // Create index for group session reviews
      await queryRunner.createIndex(
        'session_reviews',
        new TableIndex({
          name: 'IDX_session_reviews_groupSessionId_menteeId',
          columnNames: ['groupSessionId', 'menteeId'],
          isUnique: true,
          where: 'groupSessionId IS NOT NULL',
        })
      );

      logger.info('Added groupSessionId column to session_reviews table');
    } else {
      logger.info('groupSessionId column already exists in session_reviews table');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys and indexes from session_reviews
    const table = await queryRunner.getTable('session_reviews');
    if (table) {
      const foreignKey = table.foreignKeys.find(
        (fk) => fk.columnNames.indexOf('groupSessionId') !== -1
      );
      if (foreignKey) {
        await queryRunner.dropForeignKey('session_reviews', foreignKey);
      }

      const index = table.indices.find(
        (idx) => idx.name === 'IDX_session_reviews_groupSessionId_menteeId'
      );
      if (index) {
        await queryRunner.dropIndex('session_reviews', index);
      }

      const columnExists = await queryRunner.query(
        `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'session_reviews'
         AND COLUMN_NAME = 'groupSessionId'`
      );

      if (columnExists[0].count > 0) {
        await queryRunner.query(`
          ALTER TABLE session_reviews
          DROP COLUMN groupSessionId
        `);

        // Make sessionId NOT NULL again
        await queryRunner.query(`
          ALTER TABLE session_reviews
          MODIFY COLUMN sessionId VARCHAR(36) NOT NULL
        `);
      }
    }

    // Drop group_session_participants table
    await queryRunner.dropTable('group_session_participants', true);

    // Drop group_sessions table
    await queryRunner.dropTable('group_sessions', true);

    logger.info('Group sessions tables dropped successfully');
  }
}
