import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('bible_explanations')
export class BibleExplanation extends BaseEntity {
  @Index()
  @Column('varchar')
  userId!: string;

  @Column('varchar')
  translation!: string;

  @Column('varchar')
  book!: string;

  @Column('int')
  chapter!: number;

  @Column('int')
  verse!: number;

  @Column('text')
  explanation!: string;

  @Column('text', { nullable: true })
  crossReferences?: string;
}
