import { Entity, Column, CreateDateColumn, PrimaryGeneratedColumn, Index } from 'typeorm';

/** In-portal notification (the top-bar bell) for one admin. */
@Entity('admin_alerts')
@Index('IDX_admin_alerts_admin_read', ['adminUserId', 'readAt'])
export class AdminAlert {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'adminUserId', type: 'varchar', length: 36 })
  adminUserId!: string;

  /** AdminAlertEvent: mentor_application | support_ticket | subscription */
  @Column({ type: 'varchar', length: 32 })
  type!: string;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'varchar', length: 500 })
  body!: string;

  /** Portal path to open, e.g. /support/<id> */
  @Column({ type: 'varchar', length: 255, nullable: true })
  link?: string | null;

  @Column({ name: 'readAt', type: 'datetime', nullable: true })
  readAt?: Date | null;

  @CreateDateColumn()
  createdAt!: Date;
}
