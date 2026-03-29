import { Entity, Column, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

@Entity('admin_audit_logs')
export class AdminAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'adminUserId', type: 'varchar', length: 36 })
  adminUserId!: string;

  @Column({ type: 'varchar', length: 128 })
  action!: string;

  @Column({ name: 'targetType', type: 'varchar', length: 64, nullable: true })
  targetType?: string | null;

  @Column({ name: 'targetId', type: 'varchar', length: 64, nullable: true })
  targetId?: string | null;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip?: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
