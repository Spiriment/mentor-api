import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOnlineStatusToConversationParticipant1763568246573
  implements MigrationInterface
{
  name = 'AddOnlineStatusToConversationParticipant1763568246573';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add isOnline and lastSeen columns to conversation_participants table
    await queryRunner.query(`
      ALTER TABLE \`conversation_participants\` 
      ADD COLUMN \`isOnline\` tinyint NOT NULL DEFAULT 0,
      ADD COLUMN \`lastSeen\` datetime NULL
    `);
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

