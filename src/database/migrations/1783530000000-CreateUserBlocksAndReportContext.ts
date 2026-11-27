import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/** varchar(36) with the same character set and collation as users.id */
async function userIdColumnType(queryRunner: QueryRunner): Promise<string> {
  const rows = await queryRunner.query(
    `SELECT CHARACTER_SET_NAME AS cs, COLLATION_NAME AS co
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'id'`,
  );
  const cs = rows?.[0]?.cs;
  const co = rows?.[0]?.co;
  const safe = (v: unknown) => typeof v === 'string' && /^[A-Za-z0-9_]+$/.test(v);
  return safe(cs) && safe(co) ? `varchar(36) CHARACTER SET ${cs} COLLATE ${co}` : 'varchar(36)';
}

/**
 * Report & block (App Store guideline 1.2).
 * - user_blocks: who blocked whom, and the admin review of their booked sessions
 * - mentee_reports (used for every user report, mentors included): where the report came
 *   from, the reported message, and a copy of the messages around it
 */
export class CreateUserBlocksAndReportContext1783530000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('user_blocks'))) {
      // blockerId/blockedId are compared with users.id (mentor lists, admin lists). Production's
      // users.id can have a different collation from a new table's default, and comparing the
      // two fails ("Illegal mix of collations"), so use exactly the one users.id has.
      const userId = await userIdColumnType(queryRunner);
      await queryRunner.query(`
        CREATE TABLE \`user_blocks\` (
          \`id\` varchar(36) NOT NULL,
          \`blockerId\` ${userId} NOT NULL,
          \`blockedId\` ${userId} NOT NULL,
          \`blockedAt\` datetime NOT NULL,
          \`unblockedAt\` datetime NULL,
          \`sessionsReview\` varchar(16) NOT NULL DEFAULT 'none',
          \`affectedSessionIds\` json NULL,
          \`reviewedByAdminId\` varchar(36) NULL,
          \`reviewedAt\` datetime NULL,
          \`reviewNotes\` text NULL,
          \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
          PRIMARY KEY (\`id\`),
          UNIQUE INDEX \`UQ_user_blocks_pair\` (\`blockerId\`, \`blockedId\`),
          INDEX \`IDX_user_blocks_blockedId\` (\`blockedId\`),
          INDEX \`IDX_user_blocks_sessionsReview\` (\`sessionsReview\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    }

    if (await queryRunner.hasTable('mentee_reports')) {
      const columns: TableColumn[] = [
        new TableColumn({ name: 'source', type: 'varchar', length: '16', isNullable: true }),
        new TableColumn({ name: 'messageId', type: 'varchar', length: '36', isNullable: true }),
        new TableColumn({ name: 'conversationId', type: 'varchar', length: '36', isNullable: true }),
        new TableColumn({ name: 'context', type: 'json', isNullable: true }),
      ];
      for (const column of columns) {
        if (!(await queryRunner.hasColumn('mentee_reports', column.name))) {
          await queryRunner.addColumn('mentee_reports', column);
        }
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('mentee_reports')) {
      for (const name of ['context', 'conversationId', 'messageId', 'source']) {
        if (await queryRunner.hasColumn('mentee_reports', name)) {
          await queryRunner.dropColumn('mentee_reports', name);
        }
      }
    }
    await queryRunner.query('DROP TABLE IF EXISTS `user_blocks`');
  }
}
