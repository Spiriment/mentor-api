import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateRefreshTokenLength1776772892533 implements MigrationInterface {
    name = 'UpdateRefreshTokenLength1776772892533'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Legacy generated migration not safe for drifted schemas; keep no-op to allow
        // subsequent canonical migrations to complete.
        return;
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        return;
    }

}
