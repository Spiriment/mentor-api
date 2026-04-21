import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum ContactType {
  GENERAL = 'GENERAL',
  PARTNERSHIP = 'PARTNERSHIP',
  VOLUNTEER = 'VOLUNTEER',
}

export enum ContactStatus {
  UNREAD = 'UNREAD',
  READ = 'READ',
  RESOLVED = 'RESOLVED',
}

@Entity('contact_messages')
export class ContactMessage extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone?: string | null;

  @Column({ type: 'text', nullable: true })
  message?: string | null;

  @Column({ type: 'enum', enum: ContactType, default: ContactType.GENERAL })
  type!: ContactType;

  // For partnership
  @Column({ type: 'varchar', length: 255, nullable: true })
  partnershipType?: string | null;

  // For volunteer
  @Column({ type: 'varchar', length: 255, nullable: true })
  skill?: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  portfolioLink?: string | null;

  @Column({ type: 'enum', enum: ContactStatus, default: ContactStatus.UNREAD })
  status!: ContactStatus;
}
