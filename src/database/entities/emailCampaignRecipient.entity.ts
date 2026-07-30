import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum EmailCampaignRecipientStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

@Entity('email_campaign_recipients')
export class EmailCampaignRecipient {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'campaignId', type: 'varchar', length: 36 })
  campaignId!: string;

  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ name: 'userId', type: 'varchar', length: 36, nullable: true })
  userId?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  firstName?: string | null;

  @Column({
    type: 'enum',
    enum: EmailCampaignRecipientStatus,
    default: EmailCampaignRecipientStatus.PENDING,
  })
  status!: EmailCampaignRecipientStatus;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string | null;

  @Column({ type: 'datetime', nullable: true })
  sentAt?: Date | null;

  @CreateDateColumn()
  createdAt!: Date;
}
