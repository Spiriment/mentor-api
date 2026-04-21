import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateMenteeReportsTable1776900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'mentee_reports',
        columns: [
          { name: 'id', type: 'varchar', length: '36', isPrimary: true, generationStrategy: 'uuid', default: '(UUID())' },
          { name: 'reporterId', type: 'varchar', length: '36', isNullable: false },
          { name: 'reportedUserId', type: 'varchar', length: '36', isNullable: false },
          { name: 'reason', type: 'varchar', length: '128', isNullable: false },
          { name: 'details', type: 'text', isNullable: true },
          { name: 'sessionId', type: 'varchar', length: '36', isNullable: true },
          { name: 'status', type: 'varchar', length: '32', default: "'open'", isNullable: false },
          { name: 'assignedTo', type: 'varchar', length: '36', isNullable: true },
          { name: 'resolutionNotes', type: 'text', isNullable: true },
          { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP', isNullable: false },
          { name: 'updatedAt', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP', isNullable: false },
        ],
      }),
      true
    );

    await queryRunner.createIndex(
      'mentee_reports',
      new TableIndex({ name: 'IDX_mentee_reports_reporterId', columnNames: ['reporterId'] })
    );
    await queryRunner.createIndex(
      'mentee_reports',
      new TableIndex({ name: 'IDX_mentee_reports_reportedUserId', columnNames: ['reportedUserId'] })
    );
    await queryRunner.createIndex(
      'mentee_reports',
      new TableIndex({ name: 'IDX_mentee_reports_status', columnNames: ['status'] })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('mentee_reports', true);
  }
}
