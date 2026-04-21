import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('faqs')
export class Faq extends BaseEntity {
  @Column({ type: 'varchar', length: 500 })
  question!: string;

  @Column({ type: 'text' })
  answer!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category?: string | null;

  @Column({ type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ type: 'boolean', default: true })
  isPublished!: boolean;
}
