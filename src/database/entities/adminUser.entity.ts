import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';
import { ADMIN_ROLE } from '@/common/constants/adminRoles';

@Entity('admin_users')
export class AdminUser extends BaseEntity {
  @Column({
    unique: true,
    transformer: {
      to: (value: string) => value?.toLowerCase(),
      from: (value: string) => value?.toLowerCase(),
    },
  })
  email!: string;

  @Column({ select: false })
  password!: string;

  @Column({
    type: 'enum',
    enum: ADMIN_ROLE,
  })
  role!: ADMIN_ROLE;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ name: 'firstName', type: 'varchar', length: 120, nullable: true })
  firstName?: string | null;

  @Column({ name: 'lastName', type: 'varchar', length: 120, nullable: true })
  lastName?: string | null;

  @Column({ name: 'avatarUrl', type: 'varchar', length: 500, nullable: true })
  avatarUrl?: string | null;
}
