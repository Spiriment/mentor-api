import { MigrationInterface, QueryRunner } from "typeorm";

export class AddConversationIdToGroupSessionV21768304166296 implements MigrationInterface {
    name = 'AddConversationIdToGroupSessionV21768304166296'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const summariesTable = await queryRunner.getTable("monthly_summaries");
        if (summariesTable) {
            // Safely drop the foreign key if it exists
            const foreignKey = summariesTable.foreignKeys.find(fk => fk.columnNames.includes("userId"));
            if (foreignKey) {
                await queryRunner.dropForeignKey("monthly_summaries", foreignKey);
            }
            
            // Safely drop the unique index if it exists
            const uniqueIndex = summariesTable.indices.find(idx => 
                idx.columnNames.includes("userId") && 
                idx.columnNames.includes("year") && 
                idx.columnNames.includes("month")
            );
            if (uniqueIndex) {
                await queryRunner.dropIndex("monthly_summaries", uniqueIndex);
            }
        }

        // Safely add conversationId to group_sessions
        const groupSessionsTable = await queryRunner.getTable("group_sessions");
        if (groupSessionsTable && !groupSessionsTable.findColumnByName("conversationId")) {
            await queryRunner.query(`ALTER TABLE \`group_sessions\` ADD \`conversationId\` varchar(36) NULL`);
        }

        // Safely modify monthly_summaries columns
        if (summariesTable) {
            await queryRunner.query(`ALTER TABLE \`monthly_summaries\` CHANGE \`createdAt\` \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)`);
            await queryRunner.query(`ALTER TABLE \`monthly_summaries\` CHANGE \`updatedAt\` \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)`);
            
            if (summariesTable.findColumnByName("userId")) {
                // To change type safely in MySQL, we might need a multi-step approach if we want to be very careful, 
                // but usually CHANGE works if the column exists. 
                // However, the original migration did DROP and ADD. Let's make that safe.
                try {
                    // Check if it's already the new type (varchar 255) by looking at column length
                    const userIdCol = summariesTable.findColumnByName("userId");
                    if (userIdCol && userIdCol.length !== "255") {
                       await queryRunner.query(`ALTER TABLE \`monthly_summaries\` DROP COLUMN \`userId\``);
                       await queryRunner.query(`ALTER TABLE \`monthly_summaries\` ADD \`userId\` varchar(255) NOT NULL`);
                    }
                } catch (e) {
                    // If drop fails because it doesn't exist, that's fine, we'll try to add it
                    if (!summariesTable.findColumnByName("userId")) {
                        await queryRunner.query(`ALTER TABLE \`monthly_summaries\` ADD \`userId\` varchar(255) NOT NULL`);
                    }
                }
            } else {
                await queryRunner.query(`ALTER TABLE \`monthly_summaries\` ADD \`userId\` varchar(255) NOT NULL`);
            }
        }

        // Safely modify scheduled_notifications columns
        const notificationsTable = await queryRunner.getTable("scheduled_notifications");
        if (notificationsTable) {
            await queryRunner.query(`ALTER TABLE \`scheduled_notifications\` CHANGE \`createdAt\` \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)`);
            await queryRunner.query(`ALTER TABLE \`scheduled_notifications\` CHANGE \`updatedAt\` \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)`);
        }

        // Safely create indices
        const indicesToCreate = [
            { table: "monthly_summaries", name: "IDX_e40589bf15393d7803f37df767", columns: ["userId"] },
            { table: "monthly_summaries", name: "IDX_70bc68c4f5fc07c383901f1ba5", columns: ["userId", "year", "month"], unique: true },
            { table: "scheduled_notifications", name: "IDX_01d61e551f8285966b84ca09f4", columns: ["userId"] },
            { table: "scheduled_notifications", name: "IDX_92a5cc3610a9f1c695cd9f4fe3", columns: ["scheduledFor"] },
            { table: "scheduled_notifications", name: "IDX_8699a2c35955d84c795111550e", columns: ["status"] },
            { table: "scheduled_notifications", name: "IDX_244be41527b48b7f86741d8487", columns: ["userId", "status"] },
            { table: "scheduled_notifications", name: "IDX_c72f6fcad8994be378d4752a5e", columns: ["scheduledFor", "status"] }
        ];

        for (const idx of indicesToCreate) {
            const tableObj = await queryRunner.getTable(idx.table);
            if (tableObj && !tableObj.indices.find(i => i.name === idx.name)) {
                const uniqueStr = idx.unique ? "UNIQUE " : "";
                const colsStr = idx.columns.map(c => `\`${c}\``).join(", ");
                await queryRunner.query(`CREATE ${uniqueStr}INDEX \`${idx.name}\` ON \`${idx.table}\` (${colsStr})`);
            }
        }

        // Safely add foreign key
        const finalSummariesTable = await queryRunner.getTable("monthly_summaries");
        if (finalSummariesTable && !finalSummariesTable.foreignKeys.find(fk => fk.name === "FK_e40589bf15393d7803f37df7671")) {
            await queryRunner.query(`ALTER TABLE \`monthly_summaries\` ADD CONSTRAINT \`FK_e40589bf15393d7803f37df7671\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const summariesTable = await queryRunner.getTable("monthly_summaries");
        if (summariesTable) {
            const foreignKey = summariesTable.foreignKeys.find(fk => fk.columnNames.includes("userId"));
            if (foreignKey) {
                await queryRunner.dropForeignKey("monthly_summaries", foreignKey);
            }
        }

        const indicesToDrop = [
            { table: "scheduled_notifications", name: "IDX_c72f6fcad8994be378d4752a5e" },
            { table: "scheduled_notifications", name: "IDX_244be41527b48b7f86741d8487" },
            { table: "scheduled_notifications", name: "IDX_8699a2c35955d84c795111550e" },
            { table: "scheduled_notifications", name: "IDX_92a5cc3610a9f1c695cd9f4fe3" },
            { table: "scheduled_notifications", name: "IDX_01d61e551f8285966b84ca09f4" },
            { table: "monthly_summaries", name: "IDX_70bc68c4f5fc07c383901f1ba5" },
            { table: "monthly_summaries", name: "IDX_e40589bf15393d7803f37df767" }
        ];

        for (const idx of indicesToDrop) {
            const tableObj = await queryRunner.getTable(idx.table);
            if (tableObj && tableObj.indices.find(i => i.name === idx.name)) {
                await queryRunner.dropIndex(idx.table, idx.name);
            }
        }

        const notificationsTable = await queryRunner.getTable("scheduled_notifications");
        if (notificationsTable) {
            await queryRunner.query(`ALTER TABLE \`scheduled_notifications\` CHANGE \`updatedAt\` \`updatedAt\` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);
            await queryRunner.query(`ALTER TABLE \`scheduled_notifications\` CHANGE \`createdAt\` \`createdAt\` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP`);
        }
        
        if (summariesTable) {
            if (summariesTable.findColumnByName("userId")) {
                await queryRunner.query(`ALTER TABLE \`monthly_summaries\` DROP COLUMN \`userId\``);
            }
            await queryRunner.query(`ALTER TABLE \`monthly_summaries\` ADD \`userId\` varchar(36) NOT NULL`);
            await queryRunner.query(`ALTER TABLE \`monthly_summaries\` CHANGE \`updatedAt\` \`updatedAt\` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);
            await queryRunner.query(`ALTER TABLE \`monthly_summaries\` CHANGE \`createdAt\` \`createdAt\` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP`);
        }

        const groupSessionsTable = await queryRunner.getTable("group_sessions");
        if (groupSessionsTable && groupSessionsTable.findColumnByName("conversationId")) {
            await queryRunner.query(`ALTER TABLE \`group_sessions\` DROP COLUMN \`conversationId\``);
        }

        if (summariesTable) {
            if (!summariesTable.indices.find(i => i.name === "IDX_monthly_summaries_user_year_month")) {
                await queryRunner.query(`CREATE UNIQUE INDEX \`IDX_monthly_summaries_user_year_month\` ON \`monthly_summaries\` (\`userId\`, \`year\`, \`month\`)`);
            }
            if (!summariesTable.foreignKeys.find(fk => fk.name === "FK_monthly_summaries_user")) {
                await queryRunner.query(`ALTER TABLE \`monthly_summaries\` ADD CONSTRAINT \`FK_monthly_summaries_user\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
            }
        }
    }

}
