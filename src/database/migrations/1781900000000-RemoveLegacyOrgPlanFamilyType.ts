import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Family billing uses `family_plans` / `family_members`, not `org_plans`.
 * Remove legacy org_plans rows with planType = 'family' and clear user links.
 */
export class RemoveLegacyOrgPlanFamilyType1781900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE users u
      INNER JOIN org_plans p ON u.orgPlanId = p.id
      SET u.orgPlanId = NULL
      WHERE p.planType = 'family'
    `);

    await queryRunner.query(`
      DELETE FROM org_plans WHERE planType = 'family'
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Legacy family org_plans were test/seed data only; not restored on rollback.
  }
}
