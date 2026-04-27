import { MigrationInterface, QueryRunner } from "typeorm";

export class MyNewMigration1767284258965 implements MigrationInterface {
    name = 'MyNewMigration1767284258965'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // This migration was generated against a specific intermediate schema and is not
        // safe on environments that already diverged. We keep it as a no-op to avoid
        // destructive/duplicate DDL failures while allowing later migrations to run.
        return;
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        return;
    }

}
