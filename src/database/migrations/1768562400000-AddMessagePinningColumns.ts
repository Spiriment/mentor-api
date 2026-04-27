import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMessagePinningColumns1768562400000 implements MigrationInterface {
    name = 'AddMessagePinningColumns1768562400000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const hasIsPinned = await queryRunner.hasColumn('messages', 'isPinned');
        if (!hasIsPinned) {
            await queryRunner.query(`ALTER TABLE \`messages\` ADD \`isPinned\` tinyint NOT NULL DEFAULT 0`);
        }

        const hasPinnedAt = await queryRunner.hasColumn('messages', 'pinnedAt');
        if (!hasPinnedAt) {
            await queryRunner.query(`ALTER TABLE \`messages\` ADD \`pinnedAt\` timestamp NULL`);
        }

        const hasIsStarred = await queryRunner.hasColumn('messages', 'isStarred');
        if (!hasIsStarred) {
            await queryRunner.query(`ALTER TABLE \`messages\` ADD \`isStarred\` tinyint NOT NULL DEFAULT 0`);
        }

        const hasStarredAt = await queryRunner.hasColumn('messages', 'starredAt');
        if (!hasStarredAt) {
            await queryRunner.query(`ALTER TABLE \`messages\` ADD \`starredAt\` timestamp NULL`);
        }
        await queryRunner.query(`ALTER TABLE \`messages\` CHANGE \`type\` \`type\` enum('text', 'image', 'audio', 'file', 'system', 'reaction', 'call') NOT NULL DEFAULT 'text'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`messages\` CHANGE \`type\` \`type\` enum('text', 'image', 'audio', 'file', 'system', 'reaction') NOT NULL DEFAULT 'text'`);
        const hasStarredAt = await queryRunner.hasColumn('messages', 'starredAt');
        if (hasStarredAt) {
            await queryRunner.query(`ALTER TABLE \`messages\` DROP COLUMN \`starredAt\``);
        }

        const hasIsStarred = await queryRunner.hasColumn('messages', 'isStarred');
        if (hasIsStarred) {
            await queryRunner.query(`ALTER TABLE \`messages\` DROP COLUMN \`isStarred\``);
        }

        const hasPinnedAt = await queryRunner.hasColumn('messages', 'pinnedAt');
        if (hasPinnedAt) {
            await queryRunner.query(`ALTER TABLE \`messages\` DROP COLUMN \`pinnedAt\``);
        }

        const hasIsPinned = await queryRunner.hasColumn('messages', 'isPinned');
        if (hasIsPinned) {
            await queryRunner.query(`ALTER TABLE \`messages\` DROP COLUMN \`isPinned\``);
        }
    }
}
