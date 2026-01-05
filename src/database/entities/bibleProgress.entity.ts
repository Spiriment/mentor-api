import { Column, Entity, Index } from 'typeorm';
import { BaseEntityInt } from './baseInt.entity';

@Entity('bible_progress')
export class BibleProgress extends BaseEntityInt {
  @Index()
  @Column('varchar')
  userId!: string;

  @Column('varchar')
  plan!: string; // e.g., 'bible_in_a_year'

  @Column('int', { default: 0 })
  currentDay!: number;

  @Column('json', { nullable: true })
  completedDays?: number[];
}
