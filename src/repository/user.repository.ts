import { DataSource, In } from 'typeorm';
import { AppError, RedisClient } from '@/common';
import { BaseRepository } from '@/repository/base.repository';
import { PaginatedResponse } from '@/common/types';
import { User } from '@/database/entities';

export class UserRepository extends BaseRepository<User> {
  constructor(dataSource: DataSource, redis?: RedisClient | null) {
    super(User, dataSource, redis);
  }

  protected getAlias(): string {
    return 'users';
  }
}
