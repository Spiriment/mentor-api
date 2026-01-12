import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class CreateMonthlySummariesTable1767850000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'monthly_summaries',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'userId',
            type: 'varchar',
            length: '36',
          },
          {
            name: 'year',
            type: 'int',
          },
          {
            name: 'month',
            type: 'int',
          },
          {
            name: 'currentStreak',
            type: 'int',
            default: 0,
          },
          {
            name: 'longestStreak',
            type: 'int',
            default: 0,
          },
          {
            name: 'longestConsecutiveDays',
            type: 'int',
            default: 0,
          },
          {
            name: 'topBook',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'readingTimePreference',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'testamentFocus',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'sessionsCount',
            type: 'int',
            default: 0,
          },
          {
            name: 'totalReadingMinutes',
            type: 'int',
            default: 0,
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

    await queryRunner.createIndex(
      'monthly_summaries',
      new TableIndex({
        name: 'IDX_monthly_summaries_user_year_month',
        columnNames: ['userId', 'year', 'month'],
        isUnique: true,
      })
    );

    await queryRunner.createForeignKey(
      'monthly_summaries',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
        name: 'FK_monthly_summaries_user',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('monthly_summaries', 'FK_monthly_summaries_user');
    await queryRunner.dropIndex('monthly_summaries', 'IDX_monthly_summaries_user_year_month');
    await queryRunner.dropTable('monthly_summaries');
  }
}
