import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOnlineStatusToConversationParticipant1763568246573
  implements MigrationInterface
{
  name = 'AddOnlineStatusToConversationParticipant1763568246573';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Helper function to check if column exists
    const columnExists = async (tableName: string, columnName: string): Promise<boolean> => {
      const result = await queryRunner.query(
        `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = '${tableName}' 
         AND COLUMN_NAME = '${columnName}'`
      );
      return result[0].count > 0;
    };

    // Add isOnline and lastSeen columns to conversation_participants table (only if they don't exist)
    if (!(await columnExists('conversation_participants', 'isOnline'))) {
      await queryRunner.query(`
        ALTER TABLE \`conversation_participants\` 
        ADD COLUMN \`isOnline\` tinyint NOT NULL DEFAULT 0
      `);
    }
    if (!(await columnExists('conversation_participants', 'lastSeen'))) {
      await queryRunner.query(`
        ALTER TABLE \`conversation_participants\` 
        ADD COLUMN \`lastSeen\` datetime NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove the added columns
    await queryRunner.query(`
      ALTER TABLE \`conversation_participants\` 
      DROP COLUMN \`lastSeen\`,
      DROP COLUMN \`isOnline\`
    `);
  }
}

