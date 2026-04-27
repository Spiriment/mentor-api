import { Entity, Column } from 'typeorm';
import { BaseEntity } from '@/database/entities/base.entity';

@Entity('church_portal_refresh_tokens')
export class ChurchPortalRefreshToken extends BaseEntity {
  @Column({ name: 'churchPortalUserId', type: 'varchar', length: 36 })
  churchPortalUserId!: string;

  @Column({ name: 'token', type: 'text' })
  token!: string;

  @Column({ name: 'expiresAt', type: 'datetime' })
  expiresAt!: Date;
}
