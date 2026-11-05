import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

/**
 * Proof that a member agreed to a version of the church privacy notice. Kept when they leave the
 * church, so it isn't stored on the join request (deleted on leaving) and has no foreign keys.
 */
@Entity('church_privacy_acceptances')
@Unique('UQ_church_privacy_acceptance', ['userId', 'churchPortalId', 'noticeVersion'])
export class ChurchPrivacyAcceptance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'userId', type: 'varchar', length: 36 })
  userId!: string;

  @Column({ name: 'churchPortalId', type: 'varchar', length: 36 })
  churchPortalId!: string;

  @Column({ name: 'noticeVersion', type: 'varchar', length: 10 })
  noticeVersion!: string;

  /** 'join': agreed when asking to join. 'existing_member': was already a member when asked. */
  @Column({ type: 'varchar', length: 20 })
  source!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
