import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateMentorshipRequestsTable1733313600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'mentorship_requests',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'mentorId',
            type: 'varchar',
            length: '36',
          },
          {
            name: 'menteeId',
            type: 'varchar',
            length: '36',
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'accepted', 'declined', 'cancelled'],
            default: "'pending'",
          },
          {
            name: 'message',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'responseMessage',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'respondedAt',
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

    // Create index on mentorId
    await queryRunner.createIndex(
      'mentorship_requests',
      new TableIndex({
        name: 'IDX_mentorship_requests_mentor',
        columnNames: ['mentorId'],
      })
    );

    // Create index on menteeId
    await queryRunner.createIndex(
      'mentorship_requests',
      new TableIndex({
        name: 'IDX_mentorship_requests_mentee',
        columnNames: ['menteeId'],
      })
    );

    // Create unique index on mentorId + menteeId
    await queryRunner.createIndex(
      'mentorship_requests',
      new TableIndex({
        name: 'IDX_mentorship_requests_mentor_mentee_unique',
        columnNames: ['mentorId', 'menteeId'],
        isUnique: true,
      })
    );

    // Create foreign key for mentor
    await queryRunner.createForeignKey(
      'mentorship_requests',
      new TableForeignKey({
        columnNames: ['mentorId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
        name: 'FK_mentorship_requests_mentor',
      })
    );

    // Create foreign key for mentee
    await queryRunner.createForeignKey(
      'mentorship_requests',
      new TableForeignKey({
        columnNames: ['menteeId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
        name: 'FK_mentorship_requests_mentee',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys
    await queryRunner.dropForeignKey('mentorship_requests', 'FK_mentorship_requests_mentee');
    await queryRunner.dropForeignKey('mentorship_requests', 'FK_mentorship_requests_mentor');

    // Drop indices
    await queryRunner.dropIndex('mentorship_requests', 'IDX_mentorship_requests_mentor_mentee_unique');
    await queryRunner.dropIndex('mentorship_requests', 'IDX_mentorship_requests_mentee');
    await queryRunner.dropIndex('mentorship_requests', 'IDX_mentorship_requests_mentor');

    // Drop table
    await queryRunner.dropTable('mentorship_requests');
  }
}
