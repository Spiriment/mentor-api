import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { BaseEntity } from './base.entity';
import { ACCOUNT_STATUS, GENDER, USER_ROLE } from '@/common/constants';

@Entity('users')
export class User extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    unique: true,
    transformer: {
      to: (value: string) => value?.toLowerCase(),
      from: (value: string) => value?.toLowerCase(),
    },
  })
  email!: string;

  @Column({ name: 'isVerified', default: false })
  isEmailVerified!: boolean;

  @Column({ name: 'firstName', nullable: true })
  firstName?: string;

  @Column({ type: 'enum', enum: GENDER, nullable: true })
  gender?: GENDER;

  @Column({ name: 'address', nullable: true })
  address?: string;

  @Column({ name: 'city', nullable: true })
  city?: string;

  @Column({ name: 'state', nullable: true })
  state?: string;

  @Column({ name: 'emailVerifiedAt', nullable: true })
  emailVerifiedAt?: Date;

  @Column({ name: 'lastName', nullable: true })
  lastName?: string;

  @Column({ name: 'middleName', nullable: true })
  middleName?: string;

  @Column({ name: 'password', nullable: true, select: false })
  password?: string;

  @Column({
    name: 'otpTokenExpiry',
    nullable: true,
    select: false,
  })
  otpTokenExpiry?: Date;

  @Column({ name: 'otpToken', nullable: true, select: false })
  otpToken?: string;

  @Column({ name: 'isActive', default: true })
  isActive!: boolean;

  @Column({
    name: 'accountStatus',
    type: 'varchar',
    length: 50,
    default: 'active',
  })
  accountStatus!: string;

  // Mentor app specific fields
  @Column({ type: 'enum', enum: USER_ROLE, nullable: true })
  role?: USER_ROLE;

  @Column({ name: 'country', nullable: true })
  country?: string;

  @Column({ name: 'countryCode', nullable: true })
  countryCode?: string;

  @Column({ name: 'birthday', type: 'date', nullable: true })
  birthday?: Date;

  @Column({ name: 'isOnboardingComplete', default: false })
  isOnboardingComplete!: boolean;

  // Streak tracking fields
  @Column({ name: 'currentStreak', default: 0 })
  currentStreak!: number;

  @Column({ name: 'longestStreak', default: 0 })
  longestStreak!: number;

  @Column({ name: 'lastStreakDate', type: 'date', nullable: true })
  lastStreakDate?: Date;

  @Column({ name: 'weeklyStreakData', type: 'json', nullable: true })
  weeklyStreakData?: boolean[];

  @Column({ name: 'timezone', default: 'UTC' })
  timezone!: string;

  @Column({ name: 'streakFreezeCount', default: 0 })
  streakFreezeCount!: number;

  @Column({ name: 'monthlyStreakData', type: 'json', nullable: true })
  monthlyStreakData?: { [key: string]: number[] }; // { 'YYYY-MM': [1,2,3,5,10,...] }
}
