import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

@Entity('mentee_profiles')
export class MenteeProfile extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ name: 'userId', unique: true })
  userId!: string;

  // Spiritual journey data
  @Column({ name: 'bibleReadingFrequency', nullable: true })
  bibleReadingFrequency?: string;

  @Column({ name: 'scriptureConfidence', nullable: true })
  scriptureConfidence?: string;

  @Column({ name: 'currentMentorship', nullable: true })
  currentMentorship?: string;

  @Column({ name: 'spiritualGrowthAreas', type: 'json', nullable: true })
  spiritualGrowthAreas?: string[];

  @Column({ name: 'christianExperience', nullable: true })
  christianExperience?: string;

  @Column({ name: 'bibleTopics', type: 'json', nullable: true })
  bibleTopics?: string[];

  @Column({ name: 'learningPreference', nullable: true })
  learningPreference?: string;

  @Column({ name: 'mentorshipFormat', type: 'json', nullable: true })
  mentorshipFormat?: string[];

  @Column({ name: 'mentorExpectations', type: 'json', nullable: true })
  mentorExpectations?: string[];

  @Column({ name: 'spiritualGoals', type: 'json', nullable: true })
  spiritualGoals?: string[];

  @Column({ name: 'profileImage', nullable: true })
  profileImage?: string;

  @Column({ name: 'isOnboardingComplete', default: false })
  isOnboardingComplete!: boolean;

  @Column({ name: 'onboardingStep', default: 'bibleReadingFrequency' })
  onboardingStep!: string;

  // Study progress data
  @Column({ name: 'currentBook', nullable: true })
  currentBook?: string;

  @Column({ name: 'currentChapter', default: 1 })
  currentChapter?: number;

  @Column({ name: 'completedChapters', type: 'json', nullable: true })
  completedChapters?: number[];

  @Column({ name: 'studyDays', default: 0 })
  studyDays?: number;
}
