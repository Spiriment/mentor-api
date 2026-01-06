import { MigrationInterface, QueryRunner } from "typeorm";

export class AddNotificationPreferences1767701094913 implements MigrationInterface {
    name = 'AddNotificationPreferences1767701094913'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_c63848de9a345d16698e56aa80\` ON \`session_reviews\``);
        await queryRunner.query(`DROP INDEX \`IDX_scheduled_notifications_scheduledFor\` ON \`scheduled_notifications\``);
        await queryRunner.query(`DROP INDEX \`IDX_scheduled_notifications_scheduledFor_status\` ON \`scheduled_notifications\``);
        await queryRunner.query(`DROP INDEX \`IDX_scheduled_notifications_status\` ON \`scheduled_notifications\``);
        await queryRunner.query(`DROP INDEX \`IDX_scheduled_notifications_userId\` ON \`scheduled_notifications\``);
        await queryRunner.query(`DROP INDEX \`IDX_scheduled_notifications_userId_status\` ON \`scheduled_notifications\``);
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`notificationPreferences\` json NULL`);
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`pushNotificationsEnabled\` tinyint NOT NULL DEFAULT 1`);
        await queryRunner.query(`ALTER TABLE \`mentor_profiles\` ADD \`spiritualExpertise\` json NULL`);
        await queryRunner.query(`ALTER TABLE \`messages\` CHANGE \`type\` \`type\` enum ('text', 'image', 'audio', 'file', 'system', 'reaction') NOT NULL DEFAULT 'text'`);
        await queryRunner.query(`ALTER TABLE \`scheduled_notifications\` DROP COLUMN \`userId\``);
        await queryRunner.query(`ALTER TABLE \`scheduled_notifications\` ADD \`userId\` varchar(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`scheduled_notifications\` DROP COLUMN \`scheduledFor\``);
        await queryRunner.query(`ALTER TABLE \`scheduled_notifications\` ADD \`scheduledFor\` timestamp NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`scheduled_notifications\` DROP COLUMN \`sentAt\``);
        await queryRunner.query(`ALTER TABLE \`scheduled_notifications\` ADD \`sentAt\` timestamp NULL`);
        await queryRunner.query(`ALTER TABLE \`scheduled_notifications\` CHANGE \`createdAt\` \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)`);
        await queryRunner.query(`ALTER TABLE \`scheduled_notifications\` CHANGE \`updatedAt\` \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)`);
        await queryRunner.query(`CREATE INDEX \`IDX_01d61e551f8285966b84ca09f4\` ON \`scheduled_notifications\` (\`userId\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_92a5cc3610a9f1c695cd9f4fe3\` ON \`scheduled_notifications\` (\`scheduledFor\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_8699a2c35955d84c795111550e\` ON \`scheduled_notifications\` (\`status\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_244be41527b48b7f86741d8487\` ON \`scheduled_notifications\` (\`userId\`, \`status\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_c72f6fcad8994be378d4752a5e\` ON \`scheduled_notifications\` (\`scheduledFor\`, \`status\`)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`IDX_c72f6fcad8994be378d4752a5e\` ON \`scheduled_notifications\``);
        await queryRunner.query(`DROP INDEX \`IDX_244be41527b48b7f86741d8487\` ON \`scheduled_notifications\``);
        await queryRunner.query(`DROP INDEX \`IDX_8699a2c35955d84c795111550e\` ON \`scheduled_notifications\``);
        await queryRunner.query(`DROP INDEX \`IDX_92a5cc3610a9f1c695cd9f4fe3\` ON \`scheduled_notifications\``);
        await queryRunner.query(`DROP INDEX \`IDX_01d61e551f8285966b84ca09f4\` ON \`scheduled_notifications\``);
        await queryRunner.query(`ALTER TABLE \`scheduled_notifications\` CHANGE \`updatedAt\` \`updatedAt\` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE \`scheduled_notifications\` CHANGE \`createdAt\` \`createdAt\` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE \`scheduled_notifications\` DROP COLUMN \`sentAt\``);
        await queryRunner.query(`ALTER TABLE \`scheduled_notifications\` ADD \`sentAt\` datetime NULL`);
        await queryRunner.query(`ALTER TABLE \`scheduled_notifications\` DROP COLUMN \`scheduledFor\``);
        await queryRunner.query(`ALTER TABLE \`scheduled_notifications\` ADD \`scheduledFor\` datetime NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`scheduled_notifications\` DROP COLUMN \`userId\``);
        await queryRunner.query(`ALTER TABLE \`scheduled_notifications\` ADD \`userId\` varchar(36) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`messages\` CHANGE \`type\` \`type\` enum ('text', 'image', 'file', 'system', 'reaction') NOT NULL DEFAULT 'text'`);
        await queryRunner.query(`ALTER TABLE \`mentor_profiles\` DROP COLUMN \`spiritualExpertise\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`pushNotificationsEnabled\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`notificationPreferences\``);
        await queryRunner.query(`CREATE INDEX \`IDX_scheduled_notifications_userId_status\` ON \`scheduled_notifications\` (\`userId\`, \`status\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_scheduled_notifications_userId\` ON \`scheduled_notifications\` (\`userId\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_scheduled_notifications_status\` ON \`scheduled_notifications\` (\`status\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_scheduled_notifications_scheduledFor_status\` ON \`scheduled_notifications\` (\`scheduledFor\`, \`status\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_scheduled_notifications_scheduledFor\` ON \`scheduled_notifications\` (\`scheduledFor\`)`);
        await queryRunner.query(`CREATE UNIQUE INDEX \`IDX_c63848de9a345d16698e56aa80\` ON \`session_reviews\` (\`sessionId\`)`);
    }

}
