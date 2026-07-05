import { Entity, Column, CreateDateColumn, PrimaryColumn } from 'typeorm';

@Entity('processed_webhook_events')
export class ProcessedWebhookEvent {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  id!: string;

  @Column({ type: 'varchar', length: 32 })
  provider!: string;

  @Column({ type: 'varchar', length: 64 })
  eventType!: string;

  @CreateDateColumn()
  processedAt!: Date;
}
