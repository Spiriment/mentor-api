import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';
import { logger } from '@/config/int-services';

export class CreateSessionReviews1764370000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if table already exists
    const tableExists = await queryRunner.query(
      `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'session_reviews'`
    );

    if (tableExists[0].count > 0) {
      logger.info('session_reviews table already exists, skipping creation');
      return;
    }

    // Create session_reviews table
    await queryRunner.createTable(
      new Table({
        name: 'session_reviews',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'sessionId',
            type: 'varchar',
            length: '36',
          },
          {
            name: 'menteeId',
            type: 'varchar',
            length: '36',
          },
          {
            name: 'mentorId',
            type: 'varchar',
            length: '36',
          },
          {
            name: 'sessionSummary',
            type: 'text',
          },
          {
            name: 'rating',
            type: 'int',
          },
          {
            name: 'reviewText',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'learnings',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'topicsDiscussed',
            type: 'json',
            isNullable: true,
          },
          {
            name: 'nextSessionFocus',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'mentorViewed',
            type: 'boolean',
            default: false,
          },
          {
            name: 'mentorViewedAt',
            type: 'datetime',
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

    // Create unique index on sessionId (one review per session)
    const sessionIdIndexExists = await queryRunner.query(
      `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.STATISTICS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'session_reviews' 
       AND INDEX_NAME = 'IDX_session_reviews_sessionId'`
    );
    if (sessionIdIndexExists[0].count === 0) {
      await queryRunner.createIndex(
        'session_reviews',
        new TableIndex({
          name: 'IDX_session_reviews_sessionId',
          columnNames: ['sessionId'],
          isUnique: true,
        })
      );
    }

    // Create index on mentorId for efficient mentor review lookups
    const mentorIdIndexExists = await queryRunner.query(
      `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.STATISTICS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'session_reviews' 
       AND INDEX_NAME = 'IDX_session_reviews_mentorId'`
    );
    if (mentorIdIndexExists[0].count === 0) {
      await queryRunner.createIndex(
        'session_reviews',
        new TableIndex({
          name: 'IDX_session_reviews_mentorId',
          columnNames: ['mentorId'],
        })
      );
    }

    // Create index on menteeId for efficient mentee review lookups
    const menteeIdIndexExists = await queryRunner.query(
      `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.STATISTICS 
       WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'session_reviews' 
       AND INDEX_NAME = 'IDX_session_reviews_menteeId'`
    );
    if (menteeIdIndexExists[0].count === 0) {
      await queryRunner.createIndex(
        'session_reviews',
        new TableIndex({
          name: 'IDX_session_reviews_menteeId',
          columnNames: ['menteeId'],
        })
      );
    }

    // Get table after creation to check for existing foreign keys
    const table = await queryRunner.getTable('session_reviews');
    
    // Add foreign key for sessionId
    const sessionIdFkExists = table?.foreignKeys.find(
      (fk) => fk.columnNames[0] === 'sessionId'
    );
    if (!sessionIdFkExists) {
      await queryRunner.createForeignKey(
        'session_reviews',
        new TableForeignKey({
          columnNames: ['sessionId'],
          referencedTableName: 'sessions',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        })
      );
    }

    // Refresh table to get updated foreign keys
    const updatedTable = await queryRunner.getTable('session_reviews');
    
    // Add foreign key for menteeId
    const menteeIdFkExists = updatedTable?.foreignKeys.find(
      (fk) => fk.columnNames[0] === 'menteeId'
    );
    if (!menteeIdFkExists) {
      await queryRunner.createForeignKey(
        'session_reviews',
        new TableForeignKey({
          columnNames: ['menteeId'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        })
      );
    }

    // Refresh table again
    const finalTable = await queryRunner.getTable('session_reviews');
    
    // Add foreign key for mentorId
    const mentorIdFkExists = finalTable?.foreignKeys.find(
      (fk) => fk.columnNames[0] === 'mentorId'
    );
    if (!mentorIdFkExists) {
      await queryRunner.createForeignKey(
        'session_reviews',
        new TableForeignKey({
          columnNames: ['mentorId'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        })
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys first
    const table = await queryRunner.getTable('session_reviews');
    if (table) {
      const foreignKeys = table.foreignKeys;
      for (const foreignKey of foreignKeys) {
        await queryRunner.dropForeignKey('session_reviews', foreignKey);
      }
    }

    // Drop indexes
    await queryRunner.dropIndex('session_reviews', 'IDX_session_reviews_sessionId');
    await queryRunner.dropIndex('session_reviews', 'IDX_session_reviews_mentorId');
    await queryRunner.dropIndex('session_reviews', 'IDX_session_reviews_menteeId');

    // Drop table
    await queryRunner.dropTable('session_reviews');
  }
}
