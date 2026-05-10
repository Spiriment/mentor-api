import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('ai_chapter_summaries')
@Index(['book', 'chapter'], { unique: true })
export class AiChapterSummary extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  book!: string;

  @Column({ type: 'int' })
  chapter!: number;

  @Column({ type: 'text' })
  summary!: string;
}
