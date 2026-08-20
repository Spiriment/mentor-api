import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddSupportTicketAssignee1782800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('support_tickets', 'assignedAdminId'))) {
      await queryRunner.addColumn(
        'support_tickets',
        new TableColumn({
          name: 'assignedAdminId',
          type: 'varchar',
          length: '36',
          isNullable: true,
        }),
      );
    }
    if (!(await queryRunner.hasColumn('support_tickets', 'assignedAdminName'))) {
      await queryRunner.addColumn(
        'support_tickets',
        new TableColumn({
          name: 'assignedAdminName',
          type: 'varchar',
          length: '255',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('support_tickets', 'assignedAdminName')) {
      await queryRunner.dropColumn('support_tickets', 'assignedAdminName');
    }
    if (await queryRunner.hasColumn('support_tickets', 'assignedAdminId')) {
      await queryRunner.dropColumn('support_tickets', 'assignedAdminId');
    }
  }
}
