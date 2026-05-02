import { MigrationInterface, QueryRunner } from 'typeorm';
import crypto from 'crypto';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomJoinCode(): string {
  const bytes = crypto.randomBytes(12);
  let code = '';
  for (let j = 0; j < 8; j++) {
    code += CODE_CHARS[bytes[j] % CODE_CHARS.length];
  }
  return code;
}

export class AddChurchJoinCodeAndJoinRequests1780200000000 implements MigrationInterface {
  name = 'AddChurchJoinCodeAndJoinRequests1780200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasJoinCode = await queryRunner.hasColumn('church_portals', 'joinCode');
    if (!hasJoinCode) {
      await queryRunner.query(`
        ALTER TABLE \`church_portals\`
        ADD COLUMN \`joinCode\` varchar(12) NULL,
        ADD UNIQUE INDEX \`UQ_church_portals_joinCode\` (\`joinCode\`)
      `);
    }

    const portals: { id: string }[] = await queryRunner.query(
      `SELECT id FROM church_portals WHERE joinCode IS NULL OR joinCode = ''`
    );
    const existing = new Set<string>();
    const rows = await queryRunner.query(`SELECT joinCode FROM church_portals WHERE joinCode IS NOT NULL`);
    for (const r of rows) {
      if (r.joinCode) existing.add(r.joinCode);
    }
    for (const p of portals) {
      let code = randomJoinCode();
      let guard = 0;
      while (existing.has(code) && guard < 30) {
        code = randomJoinCode();
        guard++;
      }
      existing.add(code);
      await queryRunner.query(`UPDATE church_portals SET joinCode = ? WHERE id = ?`, [code, p.id]);
    }

    const hasTable = await queryRunner.hasTable('church_portal_join_requests');
    if (!hasTable) {
      await queryRunner.query(`
        CREATE TABLE \`church_portal_join_requests\` (
          \`id\` varchar(36) NOT NULL,
          \`churchPortalId\` varchar(36) NOT NULL,
          \`userId\` varchar(36) NOT NULL,
          \`status\` varchar(20) NOT NULL,
          \`resolvedAt\` datetime(6) NULL,
          \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`UQ_cpjr_portal_user\` (\`churchPortalId\`,\`userId\`),
          KEY \`IDX_cpjr_portal_status\` (\`churchPortalId\`,\`status\`)
        ) ENGINE=InnoDB
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable('church_portal_join_requests');
    if (hasTable) {
      await queryRunner.query(`DROP TABLE \`church_portal_join_requests\``);
    }
    const hasJoinCode = await queryRunner.hasColumn('church_portals', 'joinCode');
    if (hasJoinCode) {
      await queryRunner.query(`
        ALTER TABLE \`church_portals\` DROP INDEX \`UQ_church_portals_joinCode\`, DROP COLUMN \`joinCode\`
      `);
    }
  }
}
