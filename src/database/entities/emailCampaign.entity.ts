import { Column, Entity } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum EmailCampaignStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  SENDING = 'sending',
  SENT = 'sent',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum EmailCampaignAudienceType {
  ALL_USERS = 'all_users',
  ROLE_FILTER = 'role_filter',
  EXCEL_LIST = 'excel_list',
}

export type EmailCampaignAudienceConfig = {
  role?: 'mentor' | 'mentee' | 'all';
  emails?: string[];
  requireVerified?: boolean;
};

@Entity('email_campaigns')
export class EmailCampaign extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 500 })
  subject!: string;

  @Column({ type: 'longtext' })
  htmlContent!: string;

  @Column({ type: 'enum', enum: EmailCampaignAudienceType })
  audienceType!: EmailCampaignAudienceType;

  @Column({ type: 'json', nullable: true })
  audienceConfig?: EmailCampaignAudienceConfig | null;

  @Column({
    type: 'enum',
    enum: EmailCampaignStatus,
    default: EmailCampaignStatus.DRAFT,
  })
  status!: EmailCampaignStatus;

  @Column({ type: 'datetime', nullable: true })
  scheduledAt?: Date | null;

  @Column({ type: 'datetime', nullable: true })
  sentAt?: Date | null;

  @Column({ name: 'createdByAdminId', type: 'varchar', length: 36 })
  createdByAdminId!: string;

  @Column({ type: 'int', default: 0 })
  totalRecipients!: number;

  @Column({ type: 'int', default: 0 })
  sentCount!: number;

  @Column({ type: 'int', default: 0 })
  failedCount!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  replyTo?: string | null;

  @Column({ type: 'boolean', default: false })
  isTemplate!: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  templateName?: string | null;
}
