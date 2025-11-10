import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Session } from './session.entity';

@Entity('reviews')
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Session, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sessionId' })
  session!: Session;

  @Index()
  @Column()
  sessionId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mentorId' })
  mentor!: User;

  @Index()
  @Column()
  mentorId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'menteeId' })
  mentee!: User;

  @Index()
  @Column()
  menteeId!: string;

  @Column({ type: 'int' })
  rating!: number; // 1-5 stars

  @Column({ type: 'text' })
  comment!: string; // Review text

  @Column({ default: true })
  isVisible!: boolean; // Whether review is visible on mentor profile

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

