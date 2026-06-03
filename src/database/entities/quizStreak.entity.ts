import { Entity, Column, OneToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

@Entity('quiz_streaks')
export class QuizStreak extends BaseEntity {
  @Column({ unique: true })
  @Index()
  userId!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE', createForeignKeyConstraints: false })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'int', default: 0 })
  currentStreak!: number;

  @Column({ type: 'int', default: 0 })
  longestStreak!: number;

  @Column({ type: 'date', nullable: true })
  lastQuizDate?: Date;

  @Column({ type: 'json', nullable: true })
  weeklyData?: boolean[]; // [Sun, Mon, Tue, Wed, Thu, Fri, Sat]

  @Column({ type: 'json', nullable: true })
  monthlyData?: { [key: string]: number[] }; // { 'YYYY-MM': [1,2,3,...] }

  @Column({ type: 'json', nullable: true })
  highScores?: { [bookVersion: string]: number }; // { 'Genesis_1': 18, ... }
}
