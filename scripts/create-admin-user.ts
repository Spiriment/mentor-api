/**
 * Create an admin_users row for the Spiriment admin portal.
 *
 * Usage:
 *   npx cross-env NODE_ENV=development ts-node -r tsconfig-paths/register scripts/create-admin-user.ts <email> <password> <super_admin|support>
 */
import { AppDataSource } from '../src/config/data-source';
import { AdminUser } from '../src/database/entities/adminUser.entity';
import { AdminAuthService } from '../src/services/adminAuth.service';
import { Logger } from '../src/common';
import { createAdminUserCliSchema } from '../src/validation/adminAuth.validation';

const logger = new Logger({
  service: 'create-admin-user',
  level: process.env.LOG_LEVEL || 'info',
});

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  const roleRaw = process.argv[4];

  const parsed = createAdminUserCliSchema.safeParse({
    email,
    password,
    role: roleRaw,
  });

  if (!parsed.success) {
    logger.error('Invalid arguments', undefined, {
      issues: parsed.error.flatten(),
    });
    logger.info(
      'Usage: ts-node -r tsconfig-paths/register scripts/create-admin-user.ts <email> <password> <super_admin|support>'
    );
    process.exit(1);
  }

  const { email: validEmail, password: validPassword, role } = parsed.data;

  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(AdminUser);

  const existing = await repo.findOne({ where: { email: validEmail } });
  if (existing) {
    logger.error('An admin with this email already exists');
    process.exit(1);
  }

  const hash = await AdminAuthService.hashPassword(validPassword);
  const admin = repo.create({
    email: validEmail,
    password: hash,
    role,
    isActive: true,
  });
  await repo.save(admin);

  logger.info('Admin user created', { id: admin.id, email: admin.email, role: admin.role });
  await AppDataSource.destroy();
}

main().catch((err) => {
  logger.error('Failed', err instanceof Error ? err : new Error(String(err)));
  process.exit(1);
});
