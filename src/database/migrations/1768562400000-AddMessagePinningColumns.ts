import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMessagePinningColumns1768562400000 implements MigrationInterface {
    name = 'AddMessagePinningColumns1768562400000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`messages\` ADD \`isPinned\` tinyint NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE \`messages\` ADD \`pinnedAt\` timestamp NULL`);
        await queryRunner.query(`ALTER TABLE \`messages\` ADD \`isStarred\` tinyint NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE \`messages\` ADD \`starredAt\` timestamp NULL`);
        await queryRunner.query(`ALTER TABLE \`messages\` CHANGE \`type\` \`type\` enum('text', 'image', 'audio', 'file', 'system', 'reaction', 'call') NOT NULL DEFAULT 'text'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`messages\` CHANGE \`type\` \`type\` enum('text', 'image', 'audio', 'file', 'system', 'reaction') NOT NULL DEFAULT 'text'`);
        await queryRunner.query(`ALTER TABLE \`messages\` DROP COLUMN \`starredAt\``);
        await queryRunner.query(`ALTER TABLE \`messages\` DROP COLUMN \`isStarred\``);
        await queryRunner.query(`ALTER TABLE \`messages\` DROP COLUMN \`pinnedAt\``);
        await queryRunner.query(`ALTER TABLE \`messages\` DROP COLUMN \`isPinned\``);
    }
}
