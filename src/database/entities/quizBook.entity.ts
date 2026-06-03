import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { QuizQuestion } from './quizQuestion.entity';

export type QuizCategory = 'OT' | 'NT';

@Entity('quiz_books')
export class QuizBook extends BaseEntity {
  @Column({ unique: true })
  book!: string;

  @Column({ type: 'enum', enum: ['OT', 'NT'] })
  category!: QuizCategory;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder!: number;

  @OneToMany(() => QuizQuestion, (q) => q.quizBook, { cascade: true })
  questions!: QuizQuestion[];
}
