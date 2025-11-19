import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

@Entity('mentor_profiles')
export class MentorProfile extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ name: 'userId', unique: true })
  userId!: string;

  // Spiritual journey and experience data
  @Column({ name: 'christianExperience', nullable: true })
  christianExperience?: string;

  @Column({ name: 'christianJourney', type: 'text', nullable: true })
  christianJourney?: string;

  @Column({ name: 'scriptureTeaching', nullable: true })
  scriptureTeaching?: string;

  @Column({ name: 'currentMentoring', nullable: true })
  currentMentoring?: string;

  @Column({ name: 'churchAffiliation', nullable: true })
  churchAffiliation?: string;

  @Column({ name: 'leadershipRoles', nullable: true })
  leadershipRoles?: string;

  @Column({ name: 'maturityDefinition', type: 'text', nullable: true })
  maturityDefinition?: string;

  @Column({ name: 'menteeCapacity', type: 'int', nullable: true })
  menteeCapacity?: number;

  @Column({ name: 'mentorshipFormat', type: 'json', nullable: true })
  mentorshipFormat?: string[];

  @Column({ name: 'menteeCalling', type: 'json', nullable: true })
  menteeCalling?: string[];

  @Column({ name: 'videoIntroduction', nullable: true })
  videoIntroduction?: string;

  @Column({ name: 'profileImage', nullable: true })
  profileImage?: string;

  @Column({ name: 'isOnboardingComplete', default: false })
  isOnboardingComplete!: boolean;

  @Column({ name: 'onboardingStep', default: 'christianExperience' })
  onboardingStep!: string;

  @Column({ name: 'isApproved', default: false })
  isApproved!: boolean;

  @Column({ name: 'approvalNotes', type: 'text', nullable: true })
  approvalNotes?: string;

  @Column({ name: 'approvedAt', nullable: true })
  approvedAt?: Date;
}
