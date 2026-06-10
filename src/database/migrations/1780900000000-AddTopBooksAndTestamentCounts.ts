import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddTopBooksAndTestamentCounts1780900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('monthly_summaries');

    if (table) {
      if (!table.findColumnByName('topBooks')) {
        await queryRunner.addColumn('monthly_summaries', new TableColumn({
          name: 'topBooks',
          type: 'json',
          isNullable: true,
        }));
      }

      if (!table.findColumnByName('otCount')) {
        await queryRunner.addColumn('monthly_summaries', new TableColumn({
          name: 'otCount',
          type: 'int',
          default: 0,
        }));
      }

      if (!table.findColumnByName('ntCount')) {
        await queryRunner.addColumn('monthly_summaries', new TableColumn({
          name: 'ntCount',
          type: 'int',
          default: 0,
        }));
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('monthly_summaries', 'topBooks');
    await queryRunner.dropColumn('monthly_summaries', 'otCount');
    await queryRunner.dropColumn('monthly_summaries', 'ntCount');
  }
}
