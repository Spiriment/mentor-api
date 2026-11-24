import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

/**
 * Someone who signed up to the public church portal demo (spiriment-church-demo.vercel.app).
 * The demo itself runs in their browser; this is only who they are and what they looked at,
 * so the team can follow up. createdAt = first sign-up.
 */
@Entity('demo_visitors')
export class DemoVisitor extends BaseEntity {
  @Index('UQ_demo_visitors_email', { unique: true })
  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 100 })
  firstName!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  lastName!: string | null;

  /** Separate browser sessions (each sign-up or return to the demo) */
  @Column({ type: 'int', default: 1 })
  visits!: number;

  /** Portal page → times opened, e.g. { "insights": 3, "billing": 1 } */
  @Column({ type: 'json', nullable: true })
  pageViews!: Record<string, number> | null;

  @Index('IDX_demo_visitors_last_seen')
  @Column({ type: 'datetime' })
  lastSeenAt!: Date;
}
