import { Entity, Column, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { AdminUser } from './adminUser.entity';

export type SupportTicketStatus = 'open' | 'pending' | 'resolved';
export type SupportTicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type SupportTicketType =
  | 'technical_issue'
  | 'billing'
  | 'mentor_complaint'
  | 'feature_request'
  | 'other';

@Entity('support_tickets')
export class SupportTicket extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  subject!: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'userId' })
  user?: User | null;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true })
  userId?: string | null;

  @Column({ type: 'varchar', length: 255 })
  userName!: string;

  @Column({ type: 'varchar', length: 255 })
  userEmail!: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'linkedMentorId' })
  linkedMentor?: User | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  linkedMentorId?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  linkedMentorName?: string | null;

  @Column({ type: 'varchar', length: 64, default: 'other' })
  type!: SupportTicketType;

  @Index()
  @Column({ type: 'varchar', length: 32, default: 'medium' })
  priority!: SupportTicketPriority;

  @Index()
  @Column({ type: 'varchar', length: 32, default: 'open' })
  status!: SupportTicketStatus;

  @OneToMany(() => SupportTicketMessage, (message) => message.ticket)
  messages!: SupportTicketMessage[];
}

@Entity('support_ticket_messages')
export class SupportTicketMessage extends BaseEntity {
  @ManyToOne(() => SupportTicket, (ticket) => ticket.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticketId' })
  ticket!: SupportTicket;

  @Index()
  @Column({ type: 'varchar', length: 36 })
  ticketId!: string;

  @Column({ type: 'varchar', length: 255 })
  authorName!: string;

  @ManyToOne(() => AdminUser, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'adminUserId' })
  adminUser?: AdminUser | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  adminUserId?: string | null;

  @Column({ type: 'text' })
  text!: string;

  @Column({ type: 'boolean', default: false })
  isInternal!: boolean;
}
