import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { QuizBook } from './quizBook.entity';

export interface QuizOption {
  key: 'A' | 'B' | 'C' | 'D';
  text: string;
}

@Entity('quiz_questions')
@Index(['bookId', 'version'])
export class QuizQuestion extends BaseEntity {
  @Column()
  bookId!: string;

  @ManyToOne(() => QuizBook, (b) => b.questions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bookId' })
  quizBook!: QuizBook;

  @Column({ type: 'int' })
  version!: number;

  @Column({ type: 'int' })
  questionNumber!: number;

  @Column({ type: 'text' })
  question!: string;

  @Column({ type: 'json' })
  options!: QuizOption[];

  @Column({ length: 1 })
  answer!: string;

  @Column({ nullable: true })
  verse?: string;

  @Column({ default: true })
  isActive!: boolean;
}
