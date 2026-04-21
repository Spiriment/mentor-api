import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { AdminUser } from './adminUser.entity';

@Entity('blog_posts')
export class BlogPost extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  slug!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'text', nullable: true })
  excerpt?: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  coverImage?: string | null;

  @Column({ type: 'boolean', default: false })
  isPublished!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  publishedAt?: Date | null;

  @Column({ type: 'uuid', nullable: true })
  authorId?: string | null;

  @ManyToOne(() => AdminUser, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'authorId' })
  author?: AdminUser | null;
}
