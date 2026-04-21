import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateRefreshTokenLength1776772892533 implements MigrationInterface {
    name = 'UpdateRefreshTokenLength1776772892533'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`googleId\` ON \`users\``);
        await queryRunner.query(`DROP INDEX \`IDX_user_discounts_userId\` ON \`user_discounts\``);
        await queryRunner.query(`DROP INDEX \`IDX_org_plans_planType_status\` ON \`org_plans\``);
        await queryRunner.query(`DROP INDEX \`UQ_user_subscriptions_userId\` ON \`user_subscriptions\``);
        await queryRunner.query(`DROP INDEX \`IDX_admin_users_email\` ON \`admin_users\``);
        await queryRunner.query(`DROP INDEX \`IDX_admin_audit_logs_adminUserId_createdAt\` ON \`admin_audit_logs\``);
        await queryRunner.query(`ALTER TABLE \`users\` ADD UNIQUE INDEX \`IDX_f382af58ab36057334fb262efd\` (\`googleId\`)`);
        await queryRunner.query(`DROP INDEX \`IDX_4542dd2f38a61354a040ba9fd5\` ON \`refresh_tokens\``);
        await queryRunner.query(`ALTER TABLE \`refresh_tokens\` DROP COLUMN \`token\``);
        await queryRunner.query(`ALTER TABLE \`refresh_tokens\` ADD \`token\` varchar(512) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`refresh_tokens\` ADD UNIQUE INDEX \`IDX_4542dd2f38a61354a040ba9fd5\` (\`token\`)`);
        await queryRunner.query(`ALTER TABLE \`user_subscriptions\` CHANGE \`userId\` \`userId\` varchar(36) NULL`);
        await queryRunner.query(`ALTER TABLE \`admin_users\` ADD UNIQUE INDEX \`IDX_dcd0c8a4b10af9c986e510b9ec\` (\`email\`)`);
        await queryRunner.query(`ALTER TABLE \`mentor_availability\` DROP COLUMN \`dayOfWeek\``);
        await queryRunner.query(`ALTER TABLE \`mentor_availability\` ADD \`dayOfWeek\` int NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`user_subscriptions\` ADD CONSTRAINT \`FK_2dfab576863bc3f84d4f6962274\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`user_subscriptions\` DROP FOREIGN KEY \`FK_2dfab576863bc3f84d4f6962274\``);
        await queryRunner.query(`ALTER TABLE \`mentor_availability\` DROP COLUMN \`dayOfWeek\``);
        await queryRunner.query(`ALTER TABLE \`mentor_availability\` ADD \`dayOfWeek\` enum ('0', '1', '2', '3', '4', '5', '6') NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`admin_users\` DROP INDEX \`IDX_dcd0c8a4b10af9c986e510b9ec\``);
        await queryRunner.query(`ALTER TABLE \`user_subscriptions\` CHANGE \`userId\` \`userId\` varchar(36) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`refresh_tokens\` DROP INDEX \`IDX_4542dd2f38a61354a040ba9fd5\``);
        await queryRunner.query(`ALTER TABLE \`refresh_tokens\` DROP COLUMN \`token\``);
        await queryRunner.query(`ALTER TABLE \`refresh_tokens\` ADD \`token\` varchar(255) NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX \`IDX_4542dd2f38a61354a040ba9fd5\` ON \`refresh_tokens\` (\`token\`)`);
        await queryRunner.query(`ALTER TABLE \`users\` DROP INDEX \`IDX_f382af58ab36057334fb262efd\``);
        await queryRunner.query(`CREATE INDEX \`IDX_admin_audit_logs_adminUserId_createdAt\` ON \`admin_audit_logs\` (\`adminUserId\`, \`createdAt\`)`);
        await queryRunner.query(`CREATE UNIQUE INDEX \`IDX_admin_users_email\` ON \`admin_users\` (\`email\`)`);
        await queryRunner.query(`CREATE UNIQUE INDEX \`UQ_user_subscriptions_userId\` ON \`user_subscriptions\` (\`userId\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_org_plans_planType_status\` ON \`org_plans\` (\`planType\`, \`status\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_user_discounts_userId\` ON \`user_discounts\` (\`userId\`)`);
        await queryRunner.query(`CREATE UNIQUE INDEX \`googleId\` ON \`users\` (\`googleId\`)`);
    }

}
