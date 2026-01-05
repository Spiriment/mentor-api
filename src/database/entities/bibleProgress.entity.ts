import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('bible_progress')
export class BibleProgress extends BaseEntity {
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
