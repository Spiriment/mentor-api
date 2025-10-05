import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('bible_bookmarks')
export class BibleBookmark extends BaseEntity {
  @Index()
  @Column('varchar')
  userId!: string;

  @Column('varchar')
  translation!: string; // e.g., "kjv"

  @Column('varchar')
  book!: string; // e.g., "John"

  @Column('int')
  chapter!: number;

  @Column('int', { nullable: true })
  verse?: number;

  @Column('text', { nullable: true })
  note?: string;
}
