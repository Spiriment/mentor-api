import { Entity, Column, ManyToOne, Index } from 'typeorm';
import { BaseEntityInt } from './baseInt.entity';
import { User } from './user.entity';

@Entity('study_sessions')
export class StudySession extends BaseEntityInt {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user!: User;

  @Index()
  @Column({ name: 'userId' })
  userId!: string;

  @Column({ name: 'pathId' })
  pathId!: string;

  @Column({ name: 'book' })
  book!: string;

  @Column({ name: 'chapter', type: 'int' })
  chapter!: number;

  @Column({ name: 'verses', type: 'json', nullable: true })
  verses?: string[];

  @Column({ name: 'reflection', type: 'text', nullable: true })
  reflection?: string;

  @Column({ name: 'duration', type: 'int', default: 0 })
  duration!: number; // in minutes

  @Column({ name: 'completedAt', type: 'datetime' })
  completedAt!: Date;
}
