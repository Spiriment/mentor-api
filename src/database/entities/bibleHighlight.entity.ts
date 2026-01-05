import { Column, Entity, Index } from 'typeorm';
import { BaseEntityInt } from './baseInt.entity';

@Entity('bible_highlights')
export class BibleHighlight extends BaseEntityInt {
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

  @Column('varchar', { default: '#FFD54F' })
  color!: string;
}
