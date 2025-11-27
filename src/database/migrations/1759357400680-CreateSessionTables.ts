import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSessionTables1759357400680 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Helper function to check if table exists
    const tableExists = async (tableName: string): Promise<boolean> => {
      const result = await queryRunner.query(
        `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES 
         WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = '${tableName}'`
      );
      return result[0].count > 0;
    };

    // Create sessions table (only if it doesn't exist)
    if (!(await tableExists('sessions'))) {
      await queryRunner.query(`
        CREATE TABLE \`sessions\` (
          \`id\` varchar(36) NOT NULL,
          \`mentorId\` varchar(36) NOT NULL,
          \`menteeId\` varchar(36) NOT NULL,
          \`status\` enum('scheduled','confirmed','in_progress','completed','cancelled','no_show') NOT NULL DEFAULT 'scheduled',
          \`type\` enum('one_on_one','group','video_call','phone_call','in_person') NOT NULL DEFAULT 'one_on_one',
          \`duration\` enum('30','60','90','120') NOT NULL DEFAULT '60',
          \`scheduledAt\` datetime NOT NULL,
          \`startedAt\` datetime NULL,
          \`endedAt\` datetime NULL,
          \`title\` text NULL,
          \`description\` text NULL,
          \`meetingLink\` text NULL,
          \`meetingId\` text NULL,
          \`meetingPassword\` text NULL,
          \`location\` text NULL,
          \`mentorNotes\` text NULL,
          \`menteeNotes\` text NULL,
          \`sessionNotes\` text NULL,
          \`feedback\` json NULL,
          \`reminders\` json NULL,
          \`isRecurring\` tinyint NOT NULL DEFAULT 0,
          \`recurringPattern\` varchar(255) NULL,
          \`parentSessionId\` varchar(36) NULL,
          \`cancelledAt\` datetime NULL,
          \`cancellationReason\` text NULL,
          \`menteeConfirmed\` tinyint NOT NULL DEFAULT 0,
          \`mentorConfirmed\` tinyint NOT NULL DEFAULT 0,
          \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
          PRIMARY KEY (\`id\`),
          INDEX \`IDX_sessions_mentorId\` (\`mentorId\`),
          INDEX \`IDX_sessions_menteeId\` (\`menteeId\`),
          INDEX \`IDX_sessions_scheduledAt\` (\`scheduledAt\`),
          INDEX \`IDX_sessions_status\` (\`status\`),
          CONSTRAINT \`FK_sessions_mentor\` FOREIGN KEY (\`mentorId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE,
          CONSTRAINT \`FK_sessions_mentee\` FOREIGN KEY (\`menteeId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB
      `);
    }

    // Create mentor_availability table (only if it doesn't exist)
    if (!(await tableExists('mentor_availability'))) {
      await queryRunner.query(`
        CREATE TABLE \`mentor_availability\` (
          \`id\` varchar(36) NOT NULL,
          \`mentorId\` varchar(36) NOT NULL,
          \`dayOfWeek\` enum('0','1','2','3','4','5','6') NOT NULL,
          \`startTime\` time NOT NULL,
          \`endTime\` time NOT NULL,
          \`status\` enum('available','unavailable','booked') NOT NULL DEFAULT 'available',
          \`breaks\` json NULL,
          \`slotDuration\` int NOT NULL DEFAULT 30,
          \`timezone\` text NOT NULL,
          \`specificDate\` date NULL,
          \`isRecurring\` tinyint NOT NULL DEFAULT 1,
          \`notes\` text NULL,
          \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
          PRIMARY KEY (\`id\`),
          INDEX \`IDX_mentor_availability_mentorId\` (\`mentorId\`),
          INDEX \`IDX_mentor_availability_dayOfWeek\` (\`dayOfWeek\`),
          INDEX \`IDX_mentor_availability_specificDate\` (\`specificDate\`),
          CONSTRAINT \`FK_mentor_availability_mentor\` FOREIGN KEY (\`mentorId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop mentor_availability table
    await queryRunner.query(`DROP TABLE \`mentor_availability\``);

    // Drop sessions table
    await queryRunner.query(`DROP TABLE \`sessions\``);
  }
}
