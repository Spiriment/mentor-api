import { MigrationInterface, QueryRunner } from "typeorm";

export class MyNewMigration1763116843801 implements MigrationInterface {
    name = 'MyNewMigration1763116843801'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const hasReviewsTable = await queryRunner.hasTable('reviews');
        if (!hasReviewsTable) {
            return;
        }

        const existingConstraints = await queryRunner.query(`
            SELECT CONSTRAINT_NAME
            FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'reviews'
              AND CONSTRAINT_TYPE = 'FOREIGN KEY'
        `);
        const constraintNames = new Set(
            existingConstraints.map((row: { CONSTRAINT_NAME: string }) => row.CONSTRAINT_NAME)
        );

        if (!constraintNames.has('FK_a850a1d2a7c119634df63e8a030')) {
            await queryRunner.query(`ALTER TABLE \`reviews\` ADD CONSTRAINT \`FK_a850a1d2a7c119634df63e8a030\` FOREIGN KEY (\`sessionId\`) REFERENCES \`sessions\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        }
        if (!constraintNames.has('FK_560037948cc3224caa53ff1a583')) {
            await queryRunner.query(`ALTER TABLE \`reviews\` ADD CONSTRAINT \`FK_560037948cc3224caa53ff1a583\` FOREIGN KEY (\`mentorId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        }
        if (!constraintNames.has('FK_e17e297e8f0b02a81db98952bf1')) {
            await queryRunner.query(`ALTER TABLE \`reviews\` ADD CONSTRAINT \`FK_e17e297e8f0b02a81db98952bf1\` FOREIGN KEY (\`menteeId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const hasReviewsTable = await queryRunner.hasTable('reviews');
        if (!hasReviewsTable) {
            return;
        }

        const existingConstraints = await queryRunner.query(`
            SELECT CONSTRAINT_NAME
            FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'reviews'
              AND CONSTRAINT_TYPE = 'FOREIGN KEY'
        `);
        const constraintNames = new Set(
            existingConstraints.map((row: { CONSTRAINT_NAME: string }) => row.CONSTRAINT_NAME)
        );

        if (constraintNames.has('FK_e17e297e8f0b02a81db98952bf1')) {
            await queryRunner.query(`ALTER TABLE \`reviews\` DROP FOREIGN KEY \`FK_e17e297e8f0b02a81db98952bf1\``);
        }
        if (constraintNames.has('FK_560037948cc3224caa53ff1a583')) {
            await queryRunner.query(`ALTER TABLE \`reviews\` DROP FOREIGN KEY \`FK_560037948cc3224caa53ff1a583\``);
        }
        if (constraintNames.has('FK_a850a1d2a7c119634df63e8a030')) {
            await queryRunner.query(`ALTER TABLE \`reviews\` DROP FOREIGN KEY \`FK_a850a1d2a7c119634df63e8a030\``);
        }
    }

}
