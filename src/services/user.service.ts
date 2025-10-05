import { User } from '@/database/entities';
import { UserRepository } from '@/repository/user.repository';
import { RedisClient, AppError, EncryptionService } from '@/common';
import { PaginatedResponse } from '@/common/types';
import { DataSource } from 'typeorm';
import { updateUserSchema } from '../validation/user.schema';

export class UserService {
  private UserRepository: UserRepository;
  private redis: RedisClient | null;
  private encryptService?: EncryptionService;

  constructor(
    dataSource: DataSource,
    redis: RedisClient | null,
    encryptService?: EncryptionService
  ) {
    this.UserRepository = new UserRepository(dataSource, redis || undefined);
    this.encryptService = encryptService;
  }

  private getCacheKey(type: 'id' | 'email', value: string): string {
    return `User:${type}:${value}`;
  }

  async createUser(data: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    tenantId?: string;
  }): Promise<User> {
    const existingUser = await this.UserRepository.findOne({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new AppError('User with this email already exists', 400);
    }
    const hashedPassword = await this.encryptService?.hash(data.password);

    const UserToSave = new User();
    UserToSave.email = data.email;
    UserToSave.password = hashedPassword;
    UserToSave.firstName = data.firstName;
    UserToSave.lastName = data.lastName;
    UserToSave.isActive = true;

    const savedUser = await this.UserRepository.save(UserToSave);

    Object.assign(savedUser, {
      password: undefined,
    });

    return savedUser;
  }

  async getUserById(id: string): Promise<User | null> {
    const User = await this.UserRepository.findById(id);

    if (!User) {
      return null;
    }

    return User as User;
  }

  async updateUser(
    id: string,
    data: typeof updateUserSchema._type
  ): Promise<User | null> {
    const User = await this.getUserById(id);
    if (!User) {
      return null;
    }

    Object.assign(User, data);
    const updatedUser = await this.UserRepository.save(User);

    return updatedUser;
  }

  async deactivateUser(id: string): Promise<User | null> {
    const User = await this.getUserById(id);
    if (!User) {
      return null;
    }

    User.isActive = false;
    const updatedUser = await this.UserRepository.save(User);

    return updatedUser;
  }

  async listUsers(filters: any): Promise<PaginatedResponse<User>> {
    const { page = 1, limit = 10, ...where } = filters;
    const response = await this.UserRepository.findPaginated({
      options: { where: { ...where }, order: { createdAt: 'DESC' } },
      page,
      limit,
    });

    return response as PaginatedResponse<User>;
  }
}
