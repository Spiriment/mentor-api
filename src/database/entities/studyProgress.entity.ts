import { Entity, Column, ManyToOne, Index } from 'typeorm';
import { BaseEntityInt } from './baseInt.entity';
import { User } from './user.entity';

@Entity('study_progress')
export class StudyProgress extends BaseEntityInt {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user!: User;

  @Index()
  @Column({ name: 'userId' })
  userId!: string;

  @Column({ name: 'pathId' })
  pathId!: string;

  @Column({ name: 'currentBookIndex', type: 'int', default: 0 })
  currentBookIndex!: number;

  @Column({ name: 'currentChapterIndex', type: 'int', default: 0 })
  currentChapterIndex!: number;

  @Column({ name: 'completedChapters', type: 'json', nullable: true })
  completedChapters?: string[];

  @Column({ name: 'currentDay', type: 'int', default: 1 })
  currentDay!: number;

  @Column({ name: 'totalDays', type: 'int', default: 0 })
  totalDays!: number;

  @Column({ name: 'lastStudiedAt', type: 'datetime', nullable: true })
  lastStudiedAt?: Date;
}
