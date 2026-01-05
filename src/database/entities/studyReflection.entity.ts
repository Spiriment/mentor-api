import { Entity, Column, ManyToOne, Index } from 'typeorm';
import { BaseEntityInt } from './baseInt.entity';
import { User } from './user.entity';

@Entity('study_reflections')
export class StudyReflection extends BaseEntityInt {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user!: User;

  @Index()
  @Column({ name: 'userId' })
  userId!: string;

  @Column({ name: 'pathId', nullable: true })
  pathId?: string;

  @Column({ name: 'book' })
  book!: string;

  @Column({ name: 'chapter', type: 'int' })
  chapter!: number;

  @Column({ name: 'verse', type: 'int', nullable: true })
  verse?: number;

  @Column({ name: 'content', type: 'text' })
  content!: string;
}
