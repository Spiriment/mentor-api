import { Entity, Column, ManyToOne, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

@Entity('monthly_summaries')
@Index(['userId', 'year', 'month'], { unique: true })
export class MonthlySummary extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user!: User;

  @Index()
  @Column({ name: 'userId' })
  userId!: string;

  @Column({ name: 'year', type: 'int' })
  year!: number;

  @Column({ name: 'month', type: 'int' })
  month!: number;

  @Column({ name: 'currentStreak', type: 'int', default: 0 })
  currentStreak!: number;

  @Column({ name: 'longestStreak', type: 'int', default: 0 })
  longestStreak!: number;

  @Column({ name: 'longestConsecutiveDays', type: 'int', default: 0 })
  longestConsecutiveDays!: number;

  @Column({ name: 'topBook', nullable: true })
  topBook?: string;

  @Column({ name: 'readingTimePreference', nullable: true })
  readingTimePreference?: string; // Morning, Afternoon, Evening

  @Column({ name: 'testamentFocus', nullable: true })
  testamentFocus?: string; // Old Testament, New Testament, Balanced

  @Column({ name: 'sessionsCount', type: 'int', default: 0 })
  sessionsCount!: number;

  @Column({ name: 'totalReadingMinutes', type: 'int', default: 0 })
  totalReadingMinutes!: number;

  @Column({ name: 'topBookChapters', type: 'int', default: 0 })
  topBookChapters!: number;

  @Column({ name: 'totalDaysRead', type: 'int', default: 0 })
  totalDaysRead!: number;
}
