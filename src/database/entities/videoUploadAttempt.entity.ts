import { Entity, Column, CreateDateColumn, PrimaryGeneratedColumn, Index } from 'typeorm';

/**
 * One mentor intro-video upload attempt, reported by the app — successes too, so admins see
 * a failure rate rather than only complaints. See common/videoUploadAttempt.ts.
 */
@Entity('video_upload_attempts')
@Index('IDX_video_upload_attempts_user_created', ['userId', 'createdAt'])
@Index('IDX_video_upload_attempts_outcome_created', ['outcome', 'createdAt'])
export class VideoUploadAttempt {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'userId', type: 'varchar', length: 36 })
  userId!: string;

  /** success | failed (error) | rejected (didn't meet the rules: too short/long/large) */
  @Column({ type: 'varchar', length: 16 })
  outcome!: string;

  /** validation | compression | upload | save */
  @Column({ type: 'varchar', length: 16 })
  stage!: string;

  @Column({ name: 'errorMessage', type: 'varchar', length: 500, nullable: true })
  errorMessage?: string | null;

  @Column({ name: 'originalSizeBytes', type: 'bigint', nullable: true })
  originalSizeBytes?: string | null;

  @Column({ name: 'uploadSizeBytes', type: 'bigint', nullable: true })
  uploadSizeBytes?: string | null;

  @Column({ name: 'durationSeconds', type: 'int', nullable: true })
  durationSeconds?: number | null;

  /** Compression failed and the original was uploaded instead */
  @Column({ name: 'compressionFailed', type: 'boolean', default: false })
  compressionFailed!: boolean;

  @Column({ type: 'varchar', length: 10, nullable: true })
  platform?: string | null;

  @Column({ name: 'appVersion', type: 'varchar', length: 20, nullable: true })
  appVersion?: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
