import { Entity, Column } from 'typeorm';
import { BaseEntity } from '@/database/entities/base.entity';

export enum CHURCH_PORTAL_USER_ROLE {
  PASTOR = 'pastor',
  DEACON = 'deacon',
  LEADER = 'leader',
}

@Entity('church_portal_users')
export class ChurchPortalUser extends BaseEntity {
  @Column({ name: 'churchPortalId', type: 'varchar', length: 36 })
  churchPortalId!: string;

  @Column({
    name: 'email',
    unique: true,
    transformer: {
      to: (value: string) => value?.toLowerCase(),
      from: (value: string) => value?.toLowerCase(),
    },
  })
  email!: string;

  @Column({ name: 'password', type: 'varchar', length: 255, nullable: true, select: false })
  password?: string | null;

  @Column({ name: 'firstName', type: 'varchar', length: 120, nullable: true })
  firstName?: string | null;

  @Column({ name: 'lastName', type: 'varchar', length: 120, nullable: true })
  lastName?: string | null;

  @Column({
    name: 'role',
    type: 'varchar',
    length: 32,
    default: CHURCH_PORTAL_USER_ROLE.PASTOR,
  })
  role!: string;

  @Column({ name: 'isActive', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'lastLoginAt', type: 'datetime', nullable: true })
  lastLoginAt?: Date | null;

  // One-time invite token set when admin creates the account; cleared after password is set
  @Column({ name: 'inviteToken', type: 'varchar', length: 255, nullable: true, select: false })
  inviteToken?: string | null;

  @Column({ name: 'inviteTokenExpiresAt', type: 'datetime', nullable: true, select: false })
  inviteTokenExpiresAt?: Date | null;
}
