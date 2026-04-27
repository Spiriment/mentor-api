import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateRefreshTokenToText1776773586348 implements MigrationInterface {
    name = 'UpdateRefreshTokenToText1776773586348'

    public async up(queryRunner: QueryRunner): Promise<void> {
        return;
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        return;
    }

}
