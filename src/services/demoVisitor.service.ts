import { LessThan } from 'typeorm';
import { AppDataSource } from '@/config/data-source';
import { DemoVisitor } from '@/database/entities/demoVisitor.entity';
import { NotFoundError } from '@/common/errors';
import { DEMO_VISITOR_RETENTION_DAYS, demoPageKey } from '@/common/demo/demoPage';

const repo = () => AppDataSource.getRepository(DemoVisitor);

export class DemoVisitorService {
  /** Sign-up on the demo welcome page. Same email again = the same person coming back. */
  async signup(input: { firstName: string; lastName?: string | null; email: string }) {
    const now = new Date();
    const lastName = input.lastName?.trim() || null;
    // Upsert on the unique email, so two quick sign-ups can't create duplicates
    await AppDataSource.query(
      `INSERT INTO demo_visitors (id, email, firstName, lastName, visits, pageViews, lastSeenAt)
       VALUES (UUID(), ?, ?, ?, 1, NULL, ?)
       ON DUPLICATE KEY UPDATE firstName = VALUES(firstName), lastName = VALUES(lastName),
         visits = visits + 1, lastSeenAt = VALUES(lastSeenAt)`,
      [input.email, input.firstName, lastName, now]
    );
    const row = await repo().findOne({ where: { email: input.email }, select: ['id'] });
    return { id: row!.id };
  }

  /** A page opened, or a return visit. Unknown ids are ignored (e.g. deleted by an admin). */
  async activity(id: string, input: { newVisit?: boolean; page?: string }) {
    const page = demoPageKey(input.page);
    if (!page && !input.newVisit) return;
    const sets = ['lastSeenAt = ?'];
    const params: unknown[] = [new Date()];
    if (input.newVisit) sets.push('visits = visits + 1');
    if (page) {
      // page is [a-z-] only (demoPageKey), so it is safe inside the JSON path
      const path = `$."${page}"`;
      sets.push(
        `pageViews = JSON_SET(COALESCE(pageViews, JSON_OBJECT()), '${path}', COALESCE(JSON_EXTRACT(pageViews, '${path}'), 0) + 1)`
      );
    }
    params.push(id);
    await AppDataSource.query(`UPDATE demo_visitors SET ${sets.join(', ')} WHERE id = ?`, params);
  }

  /** Admin list, newest activity first. Also clears visitors not seen for a year. */
  async list() {
    const cutoff = new Date(Date.now() - DEMO_VISITOR_RETENTION_DAYS * 86_400_000);
    await repo().delete({ lastSeenAt: LessThan(cutoff) });
    const rows = await repo().find({ order: { lastSeenAt: 'DESC' } });
    const weekAgo = Date.now() - 7 * 86_400_000;
    return {
      totals: {
        visitors: rows.length,
        newLast7Days: rows.filter((r) => r.createdAt.getTime() >= weekAgo).length,
        activeLast7Days: rows.filter((r) => r.lastSeenAt.getTime() >= weekAgo).length,
        returning: rows.filter((r) => r.visits > 1).length,
      },
      data: rows.map((r) => ({
        id: r.id,
        firstName: r.firstName,
        lastName: r.lastName,
        email: r.email,
        visits: r.visits,
        pageViews: r.pageViews ?? {},
        firstSeenAt: r.createdAt,
        lastSeenAt: r.lastSeenAt,
      })),
    };
  }

  async remove(id: string) {
    const res = await repo().delete({ id });
    if (!res.affected) throw new NotFoundError('Demo visitor not found');
    return { message: 'Demo visitor deleted' };
  }
}

export const demoVisitorService = new DemoVisitorService();
