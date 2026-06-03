import { MigrationInterface, QueryRunner } from "typeorm";

export class AddHelpfulToQuizAttempt1767900000000 implements MigrationInterface {
    name = 'AddHelpfulToQuizAttempt1767900000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "quiz_attempts" ADD COLUMN IF NOT EXISTS "helpful" boolean DEFAULT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "quiz_attempts" DROP COLUMN IF EXISTS "helpful"`);
    }
}
