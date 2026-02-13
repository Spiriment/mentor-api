import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddMissingReportColumns1770033500000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('monthly_summaries');
    
    if (table) {
      if (!table.findColumnByName('topBookChapters')) {
        await queryRunner.addColumn('monthly_summaries', new TableColumn({
          name: 'topBookChapters',
          type: 'int',
          default: 0,
        }));
      }
      
      if (!table.findColumnByName('totalDaysRead')) {
        await queryRunner.addColumn('monthly_summaries', new TableColumn({
          name: 'totalDaysRead',
          type: 'int',
          default: 0,
        }));
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('monthly_summaries', 'topBookChapters');
    await queryRunner.dropColumn('monthly_summaries', 'totalDaysRead');
  }
}
