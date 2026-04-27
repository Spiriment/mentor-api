import { MigrationInterface, QueryRunner } from "typeorm";

export class AddNotificationPreferences1767701094913 implements MigrationInterface {
    name = 'AddNotificationPreferences1767701094913'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Generated migration is not resilient to pre-existing schema drift.
        // Keep as a no-op so environments can progress to later migrations.
        return;
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        return;
    }

}
