import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPushPlatformAndAppVersionToUser1783100000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('users', 'pushPlatform'))) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'pushPlatform',
          type: 'varchar',
          length: '10',
          isNullable: true,
        }),
      );
    }
    if (!(await queryRunner.hasColumn('users', 'appVersion'))) {
      await queryRunner.addColumn(
        'users',
        new TableColumn({
          name: 'appVersion',
          type: 'varchar',
          length: '20',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('users', 'appVersion')) {
      await queryRunner.dropColumn('users', 'appVersion');
    }
    if (await queryRunner.hasColumn('users', 'pushPlatform')) {
      await queryRunner.dropColumn('users', 'pushPlatform');
    }
  }
}
