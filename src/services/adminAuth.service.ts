import bcrypt from 'bcryptjs';
import { AppDataSource } from '@/config/data-source';
import { AdminUser, RefreshToken } from '@/database/entities';
import { JwtService, AppError, Logger } from '@/common';

const ADMIN_ACCESS_TTL = process.env.ADMIN_JWT_ACCESS_EXPIRES_IN ?? '8h';
const ADMIN_REFRESH_TTL = process.env.ADMIN_JWT_REFRESH_EXPIRES_IN ?? '7d';

const ADMIN_REFRESH_USER_TYPE = 'admin';

function expiresAtFromTtl(ttl: string): Date {
  const match = /^(\d+)([smhd])$/i.exec(ttl.trim());
  if (!match) {
    return new Date(Date.now() + 7 * 86_400_000);
  }
  const n = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const ms =
    unit === 's'
      ? n * 1000
      : unit === 'm'
        ? n * 60_000
        : unit === 'h'
          ? n * 3_600_000
          : n * 86_400_000;
  return new Date(Date.now() + ms);
}

export class AdminAuthService {
  private logger = new Logger({
    level: (process.env.LOG_LEVEL as 'info') || 'info',
    service: 'admin-auth-service',
  });

  constructor(private readonly jwt: JwtService) {}

  async login(email: string, password: string) {
    const repo = AppDataSource.getRepository(AdminUser);
    const admin = await repo.findOne({
      where: { email: email.trim().toLowerCase() },
      select: ['id', 'email', 'password', 'role', 'isActive'],
    });

    if (!admin || !admin.isActive) {
      this.logger.warn('Admin login failed', { email });
      throw new AppError('Invalid email or password', 401);
    }

    const ok = await bcrypt.compare(password, admin.password);
    if (!ok) {
      this.logger.warn('Admin login failed (bad password)', { email });
      throw new AppError('Invalid email or password', 401);
    }

    const accessToken = this.jwt.signAdminAccessToken(
      {
        adminId: admin.id,
        email: admin.email,
        adminRole: admin.role,
      },
      ADMIN_ACCESS_TTL
    );

    const refreshToken = this.jwt.signAdminRefreshToken(
      admin.id,
      ADMIN_REFRESH_TTL
    );

    const refreshRepo = AppDataSource.getRepository(RefreshToken);
    const expiresAt = expiresAtFromTtl(ADMIN_REFRESH_TTL);
    await refreshRepo.save(
      refreshRepo.create({
        token: refreshToken,
        userId: admin.id,
        userType: ADMIN_REFRESH_USER_TYPE,
        expiresAt,
      })
    );

    this.logger.info('Admin logged in', { adminId: admin.id, email: admin.email });

    return {
      accessToken,
      refreshToken,
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
      },
    };
  }

  async refresh(refreshToken: string) {
    const decoded = this.jwt.verifyAdminRefreshToken(refreshToken);
    const refreshRepo = AppDataSource.getRepository(RefreshToken);
    const stored = await refreshRepo.findOne({
      where: {
        token: refreshToken,
        userId: decoded.adminId,
        userType: ADMIN_REFRESH_USER_TYPE,
      },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new AppError('Invalid or expired refresh token', 401);
    }

    const repo = AppDataSource.getRepository(AdminUser);
    const admin = await repo.findOne({
      where: { id: decoded.adminId },
      select: ['id', 'email', 'role', 'isActive'],
    });

    if (!admin || !admin.isActive) {
      throw new AppError('Account is inactive', 401);
    }

    const accessToken = this.jwt.signAdminAccessToken(
      {
        adminId: admin.id,
        email: admin.email,
        adminRole: admin.role,
      },
      ADMIN_ACCESS_TTL
    );

    const newRefresh = this.jwt.signAdminRefreshToken(
      admin.id,
      ADMIN_REFRESH_TTL
    );

    await refreshRepo.delete({ id: stored.id });
    const expiresAt = expiresAtFromTtl(ADMIN_REFRESH_TTL);
    await refreshRepo.save(
      refreshRepo.create({
        token: newRefresh,
        userId: admin.id,
        userType: ADMIN_REFRESH_USER_TYPE,
        expiresAt,
      })
    );

    return {
      accessToken,
      refreshToken: newRefresh,
      admin: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
      },
    };
  }

  async logout(refreshToken: string) {
    const decoded = this.jwt.verifyAdminRefreshToken(refreshToken);
    const refreshRepo = AppDataSource.getRepository(RefreshToken);
    await refreshRepo.delete({
      userId: decoded.adminId,
      token: refreshToken,
      userType: ADMIN_REFRESH_USER_TYPE,
    });
  }

  /** Used by bootstrap script; bcrypt cost 10. */
  static async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 10);
  }
}
