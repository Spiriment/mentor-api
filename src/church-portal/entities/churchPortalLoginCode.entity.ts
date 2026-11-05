import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * One emailed sign-in code. Used and replaced codes stay for a day, which is what lets the service
 * limit how many are sent per hour. The password must be right before one is ever created.
 */
@Entity('church_portal_login_codes')
@Index('IDX_church_portal_login_codes_user', ['portalUserId', 'createdAt'])
export class ChurchPortalLoginCode {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'portalUserId', type: 'varchar', length: 36 })
  portalUserId!: string;

  @Column({ name: 'codeHash', type: 'varchar', length: 255 })
  codeHash!: string;

  @Column({ name: 'expiresAt', type: 'datetime' })
  expiresAt!: Date;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  /** Set when the code is used, replaced, or burned by wrong guesses */
  @Column({ name: 'usedAt', type: 'datetime', nullable: true })
  usedAt?: Date | null;

  @CreateDateColumn()
  createdAt!: Date;
}
