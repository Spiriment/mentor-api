import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Who did what in a church's portal. Names are copied in, so an entry still reads correctly after
 * that person leaves. There is deliberately no way to edit or delete entries through the API.
 */
@Entity('church_portal_history')
@Index('IDX_church_portal_history_portal_created', ['churchPortalId', 'createdAt'])
export class ChurchPortalHistoryEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'churchPortalId', type: 'varchar', length: 36 })
  churchPortalId!: string;

  /** Null when it wasn't a portal user: Spiriment support, or the automatic invoice */
  @Column({ name: 'actorPortalUserId', type: 'varchar', length: 36, nullable: true })
  actorPortalUserId?: string | null;

  @Column({ name: 'actorName', type: 'varchar', length: 255 })
  actorName!: string;

  @Column({ type: 'varchar', length: 64 })
  action!: string;

  @Column({ name: 'targetName', type: 'varchar', length: 255, nullable: true })
  targetName?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  detail?: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
