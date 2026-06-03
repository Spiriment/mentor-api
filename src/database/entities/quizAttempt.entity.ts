import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

@Entity('quiz_attempts')
@Index(['userId', 'book', 'version'])
export class QuizAttempt extends BaseEntity {
  @Column()
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', createForeignKeyConstraints: false })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column()
  book!: string;

  @Column({ type: 'int' })
  version!: number;

  @Column({ type: 'int' })
  score!: number;

  @Column({ type: 'int' })
  total!: number;

  @Column({ type: 'timestamp' })
  completedAt!: Date;

  // Store per-question answers for review
  @Column({ type: 'json', nullable: true })
  answers?: { questionId: string; selected: string; correct: boolean }[];
}
