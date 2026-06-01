import { AppDataSource } from '@/config/data-source';
import { Session, SESSION_STATUS } from '@/database/entities/session.entity';
import { User } from '@/database/entities/user.entity';
import { AppError, Logger } from '@/common';
import { Brackets } from 'typeorm';

const DEFAULT_PAGE = 1;
const MAX_LIMIT = 100;

export class AdminSessionService {
  private logger = new Logger({ service: 'admin-session-service', level: process.env.LOG_LEVEL || 'info' });

  async listSessions(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    type?: string;
    mentorId?: string;
    menteeId?: string;
  }) {
    const page = Math.max(1, params.page ?? DEFAULT_PAGE);
    const limit = Math.min(MAX_LIMIT, Math.max(1, params.limit ?? 20));
    const skip = (page - 1) * limit;

    const qb = AppDataSource.getRepository(Session)
      .createQueryBuilder('s')
      .leftJoin('s.mentor', 'mentor')
      .leftJoin('s.mentee', 'mentee')
      .addSelect(['mentor.id', 'mentor.firstName', 'mentor.lastName', 'mentor.email'])
      .addSelect(['mentee.id', 'mentee.firstName', 'mentee.lastName', 'mentee.email'])
      .orderBy('s.scheduledAt', 'DESC');

    if (params.status && params.status !== 'all') {
      qb.andWhere('s.status = :status', { status: params.status });
    }

    if (params.type && params.type !== 'all') {
      qb.andWhere('s.type = :type', { type: params.type });
    }

    if (params.mentorId) {
      qb.andWhere('s.mentorId = :mentorId', { mentorId: params.mentorId });
    }

    if (params.menteeId) {
      qb.andWhere('s.menteeId = :menteeId', { menteeId: params.menteeId });
    }

    if (params.search) {
      const search = `%${params.search.toLowerCase()}%`;
      qb.andWhere(
        new Brackets(q => {
          q.where('LOWER(mentor.firstName) LIKE :s', { s: search })
            .orWhere('LOWER(mentor.lastName) LIKE :s', { s: search })
            .orWhere('LOWER(mentor.email) LIKE :s', { s: search })
            .orWhere('LOWER(mentee.firstName) LIKE :s', { s: search })
            .orWhere('LOWER(mentee.lastName) LIKE :s', { s: search })
            .orWhere('LOWER(mentee.email) LIKE :s', { s: search })
            .orWhere('LOWER(s.title) LIKE :s', { s: search });
        })
      );
    }

    const [sessions, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return {
      data: sessions.map(s => this.formatSession(s)),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getSessionById(sessionId: string) {
    const session = await AppDataSource.getRepository(Session)
      .createQueryBuilder('s')
      .leftJoin('s.mentor', 'mentor')
      .leftJoin('s.mentee', 'mentee')
      .addSelect(['mentor.id', 'mentor.firstName', 'mentor.lastName', 'mentor.email', 'mentor.profileImage'])
      .addSelect(['mentee.id', 'mentee.firstName', 'mentee.lastName', 'mentee.email', 'mentee.profileImage'])
      .where('s.id = :id', { id: sessionId })
      .getOne();

    if (!session) throw new AppError('Session not found', 404);
    return this.formatSession(session, true);
  }

  async updateSessionStatus(sessionId: string, status: SESSION_STATUS) {
    const repo = AppDataSource.getRepository(Session);
    const session = await repo.findOne({ where: { id: sessionId } });
    if (!session) throw new AppError('Session not found', 404);

    session.status = status;
    if (status === SESSION_STATUS.CANCELLED) session.cancelledAt = new Date();
    await repo.save(session);
    return { success: true, status };
  }

  private formatSession(s: Session, detail = false) {
    const mentor = (s as any).mentor as User | undefined;
    const mentee = (s as any).mentee as User | undefined;

    const base = {
      id: s.id,
      status: s.status,
      type: s.type,
      duration: s.duration,
      scheduledAt: s.scheduledAt,
      startedAt: s.startedAt ?? null,
      endedAt: s.endedAt ?? null,
      createdAt: s.createdAt,
      mentor: mentor ? {
        id: mentor.id,
        firstName: mentor.firstName,
        lastName: mentor.lastName,
        email: mentor.email,
      } : null,
      mentee: mentee ? {
        id: mentee.id,
        firstName: mentee.firstName,
        lastName: mentee.lastName,
        email: mentee.email,
      } : null,
    };

    if (!detail) return base;

    return {
      ...base,
      title: s.title ?? null,
      description: s.description ?? null,
      meetingLink: s.meetingLink ?? null,
      location: s.location ?? null,
      mentorNotes: s.mentorNotes ?? null,
      menteeNotes: s.menteeNotes ?? null,
      sessionSummary: s.sessionSummary ?? null,
      assignments: s.assignments ?? [],
      feedback: s.feedback ?? null,
      cancellationReason: s.cancellationReason ?? null,
    };
  }
}

export const adminSessionService = new AdminSessionService();
