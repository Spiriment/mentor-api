import type { AdminUser } from '@/database/entities/adminUser.entity';

declare global {
  namespace Express {
    interface Request {
      /** Set by admin auth middleware for `/api/admin` protected routes. */
      admin?: AdminUser;
    }
  }
}

export {};
