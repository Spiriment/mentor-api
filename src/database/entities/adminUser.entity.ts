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
}
