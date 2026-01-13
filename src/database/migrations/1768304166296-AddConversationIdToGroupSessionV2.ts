import { MigrationInterface, QueryRunner } from "typeorm";

export class AddConversationIdToGroupSessionV21768304166296 implements MigrationInterface {
    name = 'AddConversationIdToGroupSessionV21768304166296'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Safely drop the foreign key if it exists
        const table = await queryRunner.getTable("monthly_summaries");
        if (table) {
            const foreignKey = table.foreignKeys.find(fk => fk.columnNames.includes("userId"));
            if (foreignKey) {
                await queryRunner.dropForeignKey("monthly_summaries", foreignKey);
            }
            
            // Safely drop the unique index if it exists
            // We search for an index involving [userId, year, month] which was the unique one
            const uniqueIndex = table.indices.find(idx => 
                idx.columnNames.includes("userId") && 
                idx.columnNames.includes("year") && 
                idx.columnNames.includes("month")
            );
            if (uniqueIndex) {
                await queryRunner.dropIndex("monthly_summaries", uniqueIndex);
            }
        }

        await queryRunner.query(`ALTER TABLE \`group_sessions\` ADD \`conversationId\` varchar(36) NULL`);
        await queryRunner.query(`ALTER TABLE \`monthly_summaries\` CHANGE \`createdAt\` \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)`);
        await queryRunner.query(`ALTER TABLE \`monthly_summaries\` CHANGE \`updatedAt\` \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)`);
        await queryRunner.query(`ALTER TABLE \`monthly_summaries\` DROP COLUMN \`userId\``);
        await queryRunner.query(`ALTER TABLE \`monthly_summaries\` ADD \`userId\` varchar(255) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`scheduled_notifications\` CHANGE \`createdAt\` \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)`);
        await queryRunner.query(`ALTER TABLE \`scheduled_notifications\` CHANGE \`updatedAt\` \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)`);
        await queryRunner.query(`CREATE INDEX \`IDX_e40589bf15393d7803f37df767\` ON \`monthly_summaries\` (\`userId\`)`);
        await queryRunner.query(`CREATE UNIQUE INDEX \`IDX_70bc68c4f5fc07c383901f1ba5\` ON \`monthly_summaries\` (\`userId\`, \`year\`, \`month\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_01d61e551f8285966b84ca09f4\` ON \`scheduled_notifications\` (\`userId\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_92a5cc3610a9f1c695cd9f4fe3\` ON \`scheduled_notifications\` (\`scheduledFor\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_8699a2c35955d84c795111550e\` ON \`scheduled_notifications\` (\`status\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_244be41527b48b7f86741d8487\` ON \`scheduled_notifications\` (\`userId\`, \`status\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_c72f6fcad8994be378d4752a5e\` ON \`scheduled_notifications\` (\`scheduledFor\`, \`status\`)`);
        await queryRunner.query(`ALTER TABLE \`monthly_summaries\` ADD CONSTRAINT \`FK_e40589bf15393d7803f37df7671\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable("monthly_summaries");
        if (table) {
            const foreignKey = table.foreignKeys.find(fk => fk.columnNames.includes("userId"));
            if (foreignKey) {
                await queryRunner.dropForeignKey("monthly_summaries", foreignKey);
            }
        }

        await queryRunner.query(`DROP INDEX \`IDX_c72f6fcad8994be378d4752a5e\` ON \`scheduled_notifications\``);
        await queryRunner.query(`DROP INDEX \`IDX_244be41527b48b7f86741d8487\` ON \`scheduled_notifications\``);
        await queryRunner.query(`DROP INDEX \`IDX_8699a2c35955d84c795111550e\` ON \`scheduled_notifications\``);
        await queryRunner.query(`DROP INDEX \`IDX_92a5cc3610a9f1c695cd9f4fe3\` ON \`scheduled_notifications\``);
        await queryRunner.query(`DROP INDEX \`IDX_01d61e551f8285966b84ca09f4\` ON \`scheduled_notifications\``);
        
        if (table) {
            const uniqueIndex = table.indices.find(idx => 
                idx.columnNames.includes("userId") && 
                idx.columnNames.includes("year") && 
                idx.columnNames.includes("month")
            );
            if (uniqueIndex) {
                await queryRunner.dropIndex("monthly_summaries", uniqueIndex);
            }
            
            const userIdIndex = table.indices.find(idx => 
                idx.columnNames.length === 1 && idx.columnNames.includes("userId")
            );
            if (userIdIndex) {
              await queryRunner.dropIndex("monthly_summaries", userIdIndex);
            }
        }

        await queryRunner.query(`ALTER TABLE \`scheduled_notifications\` CHANGE \`updatedAt\` \`updatedAt\` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE \`scheduled_notifications\` CHANGE \`createdAt\` \`createdAt\` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE \`monthly_summaries\` DROP COLUMN \`userId\``);
        await queryRunner.query(`ALTER TABLE \`monthly_summaries\` ADD \`userId\` varchar(36) NOT NULL`);
        await queryRunner.query(`ALTER TABLE \`monthly_summaries\` CHANGE \`updatedAt\` \`updatedAt\` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE \`monthly_summaries\` CHANGE \`createdAt\` \`createdAt\` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE \`group_sessions\` DROP COLUMN \`conversationId\``);
        await queryRunner.query(`CREATE UNIQUE INDEX \`IDX_monthly_summaries_user_year_month\` ON \`monthly_summaries\` (\`userId\`, \`year\`, \`month\`)`);
        await queryRunner.query(`ALTER TABLE \`monthly_summaries\` ADD CONSTRAINT \`FK_monthly_summaries_user\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
