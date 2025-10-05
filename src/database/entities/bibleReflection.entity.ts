import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('bible_reflections')
export class BibleReflection extends BaseEntity {
  @Index()
  @Column('varchar')
  userId!: string;

  @Column('varchar')
  translation!: string;

  @Column('varchar')
  book!: string;

  @Column('int')
  chapter!: number;

  @Column('int', { nullable: true })
  verse?: number;

  @Column('text')
  content!: string;
}
