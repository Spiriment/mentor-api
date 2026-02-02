import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMissedStatusToGroupSessions1770033422320 implements MigrationInterface {
    name = 'AddMissedStatusToGroupSessions1770033422320'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`group_sessions\` CHANGE \`status\` \`status\` enum ('draft', 'invites_sent', 'confirmed', 'in_progress', 'completed', 'cancelled', 'missed') NOT NULL DEFAULT 'draft'`);
        await queryRunner.query(`ALTER TABLE \`messages\` DROP COLUMN \`pinnedAt\``);
        await queryRunner.query(`ALTER TABLE \`messages\` ADD \`pinnedAt\` datetime NULL`);
        await queryRunner.query(`ALTER TABLE \`messages\` DROP COLUMN \`starredAt\``);
        await queryRunner.query(`ALTER TABLE \`messages\` ADD \`starredAt\` datetime NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`messages\` DROP COLUMN \`starredAt\``);
        await queryRunner.query(`ALTER TABLE \`messages\` ADD \`starredAt\` timestamp NULL`);
        await queryRunner.query(`ALTER TABLE \`messages\` DROP COLUMN \`pinnedAt\``);
        await queryRunner.query(`ALTER TABLE \`messages\` ADD \`pinnedAt\` timestamp NULL`);
        await queryRunner.query(`ALTER TABLE \`group_sessions\` CHANGE \`status\` \`status\` enum ('draft', 'invites_sent', 'confirmed', 'in_progress', 'completed', 'cancelled') NOT NULL DEFAULT 'draft'`);
    }

}
