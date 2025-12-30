import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTimezoneColumns1764091477910 implements MigrationInterface {
    name = 'AddTimezoneColumns1764091477910'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add timezone column if it doesn't exist
        const timezoneExists = await queryRunner.query(
            `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
             WHERE TABLE_SCHEMA = DATABASE() 
             AND TABLE_NAME = 'users' 
             AND COLUMN_NAME = 'timezone'`
        );
        if (timezoneExists[0].count === 0) {
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`timezone\` varchar(255) NOT NULL DEFAULT 'UTC'`);
        }

        // Add streakFreezeCount column if it doesn't exist
        const freezeCountExists = await queryRunner.query(
            `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
             WHERE TABLE_SCHEMA = DATABASE() 
             AND TABLE_NAME = 'users' 
             AND COLUMN_NAME = 'streakFreezeCount'`
        );
        if (freezeCountExists[0].count === 0) {
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`streakFreezeCount\` int NOT NULL DEFAULT '0'`);
        }

        // Add monthlyStreakData column if it doesn't exist
        const monthlyDataExists = await queryRunner.query(
            `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
             WHERE TABLE_SCHEMA = DATABASE() 
             AND TABLE_NAME = 'users' 
             AND COLUMN_NAME = 'monthlyStreakData'`
        );
        if (monthlyDataExists[0].count === 0) {
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`monthlyStreakData\` json NULL`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`sessions\` CHANGE \`status\` \`status\` enum ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show', 'rescheduled') NOT NULL DEFAULT 'scheduled'`);
        await queryRunner.query(`ALTER TABLE \`mentor_profiles\` DROP COLUMN \`menteeCapacity\``);
        await queryRunner.query(`ALTER TABLE \`mentor_profiles\` ADD \`menteeCapacity\` varchar(255) NULL`);
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`monthlyStreakData\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`streakFreezeCount\``);
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`timezone\``);
        await queryRunner.query(`ALTER TABLE \`sessions\` ADD \`assignments\` json NULL`);
        await queryRunner.query(`ALTER TABLE \`sessions\` ADD \`sessionSummary\` text NULL`);
        await queryRunner.query(`ALTER TABLE \`mentee_profiles\` ADD \`availability\` json NULL`);
    }

}
