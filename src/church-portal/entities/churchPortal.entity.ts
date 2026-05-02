import { Entity, Column } from 'typeorm';
import { BaseEntity } from '@/database/entities/base.entity';

export enum CHURCH_PORTAL_STATUS {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
}

@Entity('church_portals')
export class ChurchPortal extends BaseEntity {
  @Column({ name: 'orgPlanId', type: 'varchar', length: 36, nullable: true })
  orgPlanId?: string | null;

  @Column({ name: 'name', type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'slug', type: 'varchar', length: 100, unique: true })
  slug!: string;

  @Column({ name: 'logoUrl', type: 'varchar', length: 500, nullable: true })
  logoUrl?: string | null;

  @Column({ name: 'denomination', type: 'varchar', length: 100, nullable: true })
  denomination?: string | null;

  @Column({ name: 'city', type: 'varchar', length: 100, nullable: true })
  city?: string | null;

  @Column({ name: 'country', type: 'varchar', length: 100, nullable: true })
  country?: string | null;

  @Column({ name: 'timezone', type: 'varchar', length: 64, default: 'UTC' })
  timezone!: string;

  @Column({
    name: 'status',
    type: 'varchar',
    length: 24,
    default: CHURCH_PORTAL_STATUS.ACTIVE,
  })
  status!: string;

  /** Shareable code for mobile members (distinct from URL slug). */
  @Column({ name: 'joinCode', type: 'varchar', length: 12, unique: true, nullable: true })
  joinCode?: string | null;

  @Column({ name: 'metadata', type: 'json', nullable: true })
  metadata?: Record<string, any> | null;
}

