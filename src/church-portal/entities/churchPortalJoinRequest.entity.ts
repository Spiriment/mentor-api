import { Entity, Column, Unique } from 'typeorm';
import { BaseEntity } from '@/database/entities/base.entity';

export enum CHURCH_JOIN_REQUEST_STATUS {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('church_portal_join_requests')
@Unique(['churchPortalId', 'userId'])
export class ChurchPortalJoinRequest extends BaseEntity {
  @Column({ name: 'churchPortalId', type: 'varchar', length: 36 })
  churchPortalId!: string;

  @Column({ name: 'userId', type: 'varchar', length: 36 })
  userId!: string;

  @Column({ type: 'varchar', length: 20 })
  status!: string;

  @Column({ name: 'resolvedAt', type: 'datetime', precision: 6, nullable: true })
  resolvedAt?: Date | null;
}
