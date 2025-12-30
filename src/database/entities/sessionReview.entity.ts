import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Session } from './session.entity';

@Entity('session_reviews')
@Index(['sessionId'], { unique: true, where: 'sessionId IS NOT NULL' }) // One review per regular session
@Index(['groupSessionId', 'menteeId'], { unique: true, where: 'groupSessionId IS NOT NULL' }) // One review per mentee per group session
export class SessionReview {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Session, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sessionId' })
  session?: Session;

  @Column({ nullable: true })
  sessionId?: string;

  @ManyToOne('GroupSession', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'groupSessionId' })
  groupSession?: any;

  @Column({ nullable: true })
  groupSessionId?: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'menteeId' })
  mentee!: User;

  @Column()
  menteeId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mentorId' })
  mentor!: User;

  @Column()
  mentorId!: string;

  // Session Summary (written by mentee)
  @Column({ type: 'text' })
  sessionSummary!: string;

  // Review fields
  @Column({ type: 'int' })
  rating!: number; // 1-5 stars

  @Column({ type: 'text', nullable: true })
  reviewText?: string;

  // Optional: What did you learn?
  @Column({ type: 'text', nullable: true })
  learnings?: string;

  // Optional: What topics were discussed?
  @Column({ type: 'json', nullable: true })
  topicsDiscussed?: string[];

  // Optional: What would you like to focus on next?
  @Column({ type: 'text', nullable: true })
  nextSessionFocus?: string;

  // Track if mentor has seen the review
  @Column({ default: false })
  mentorViewed!: boolean;

  @Column({ type: 'datetime', nullable: true })
  mentorViewedAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
