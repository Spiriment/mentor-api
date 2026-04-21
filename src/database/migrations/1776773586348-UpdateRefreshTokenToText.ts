import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateRefreshTokenToText1776773586348 implements MigrationInterface {
    name = 'UpdateRefreshTokenToText1776773586348'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_4542dd2f38a61354a040ba9fd5\` ON \`refresh_tokens\``);
        await queryRunner.query(`ALTER TABLE \`refresh_tokens\` DROP COLUMN \`token\``);
        await queryRunner.query(`ALTER TABLE \`refresh_tokens\` ADD \`token\` text NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`refresh_tokens\` DROP COLUMN \`token\``);
        await queryRunner.query(`ALTER TABLE \`refresh_tokens\` ADD \`token\` varchar(512) NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX \`IDX_4542dd2f38a61354a040ba9fd5\` ON \`refresh_tokens\` (\`token\`)`);
    }

}
