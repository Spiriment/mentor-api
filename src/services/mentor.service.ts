import { AppDataSource } from '@/config/data-source';
import { Session, SESSION_STATUS } from '@/database/entities/session.entity';
import { User } from '@/database/entities/user.entity';
import { MenteeProfile } from '@/database/entities/menteeProfile.entity';
import { Logger } from '@/common';
import { AppError } from '@/common/errors';
import { StatusCodes } from 'http-status-codes';

export interface DashboardData {
  todaysSessions: Array<{
    id: string;
    mentee: {
      id: string;
      name: string;
      avatar?: string;
    };
    scheduledAt: Date;
    status: string;
    title?: string;
    description?: string;
  }>;
  recentMentees: Array<{
    id: string;
    name: string;
    avatar?: string;
    lastSeen?: Date;
    lastSessionAt?: Date;
  }>;
  stats: {
    totalMentees: number;
    activeSessions: number;
    upcomingSessions: number;
  };
}

export interface MenteeListItem {
  id: string;
  name: string;
  avatar?: string;
  lastSeen?: Date;
  lastSessionAt?: Date;
  activeSessions: number;
  totalSessions: number;
  email?: string;
}

export class MentorService {
  private sessionRepository = AppDataSource.getRepository(Session);
  private userRepository = AppDataSource.getRepository(User);
  private menteeProfileRepository = AppDataSource.getRepository(MenteeProfile);
  private logger: Logger;

  constructor() {
    this.logger = new Logger({
      service: 'mentor-service',
      level: process.env.LOG_LEVEL || 'info',
    });
  }

  /**
   * Get mentor dashboard data
   * Includes today's sessions, recent mentees, and stats
   */
  async getDashboard(mentorId: string): Promise<DashboardData> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Get today's sessions
      const todaysSessions = await this.sessionRepository
        .createQueryBuilder('session')
        .leftJoinAndSelect('session.mentee', 'mentee')
        .where('session.mentorId = :mentorId', { mentorId })
        .andWhere('session.scheduledAt >= :today', { today })
        .andWhere('session.scheduledAt < :tomorrow', { tomorrow })
        .andWhere('session.status IN (:...statuses)', {
          statuses: [SESSION_STATUS.SCHEDULED, SESSION_STATUS.CONFIRMED],
        })
        .orderBy('session.scheduledAt', 'ASC')
        .getMany();

      // Get mentee profiles for today's sessions
      const menteeIds = [...new Set(todaysSessions.map((s) => s.menteeId))];
      const menteeProfiles = await this.menteeProfileRepository.find({
        where: menteeIds.map((id) => ({ userId: id })),
        select: ['userId', 'profileImage'],
      });
      const profileMap = new Map(
        menteeProfiles.map((p) => [p.userId, p.profileImage])
      );

      // Get all unique mentees for this mentor
      const allSessions = await this.sessionRepository
        .createQueryBuilder('session')
        .leftJoinAndSelect('session.mentee', 'mentee')
        .where('session.mentorId = :mentorId', { mentorId })
        .andWhere('session.status != :cancelled', {
          cancelled: SESSION_STATUS.CANCELLED,
        })
        .orderBy('session.scheduledAt', 'DESC')
        .getMany();

      // Get all mentee profiles
      const allMenteeIds = [...new Set(allSessions.map((s) => s.menteeId))];
      const allMenteeProfiles = await this.menteeProfileRepository.find({
        where: allMenteeIds.map((id) => ({ userId: id })),
        select: ['userId', 'profileImage'],
      });
      const allProfileMap = new Map(
        allMenteeProfiles.map((p) => [p.userId, p.profileImage])
      );

      // Extract unique mentees with their last session
      const menteeMap = new Map<string, any>();
      allSessions.forEach((session) => {
        const menteeId = session.menteeId;
        if (!menteeMap.has(menteeId)) {
          const mentee = session.mentee;
          menteeMap.set(menteeId, {
            id: menteeId,
            name:
              mentee.firstName && mentee.lastName
                ? `${mentee.firstName} ${mentee.lastName}`
                : mentee.email || 'Unknown Mentee',
            avatar: allProfileMap.get(menteeId) || undefined,
            lastSessionAt: session.scheduledAt,
          });
        }
      });

      // Get recent mentees (last 5, sorted by last session)
      const recentMentees = Array.from(menteeMap.values())
        .sort((a, b) => {
          const dateA = a.lastSessionAt
            ? new Date(a.lastSessionAt).getTime()
            : 0;
          const dateB = b.lastSessionAt
            ? new Date(b.lastSessionAt).getTime()
            : 0;
          return dateB - dateA;
        })
        .slice(0, 5);

      // Get stats
      const totalMentees = menteeMap.size;

      const activeSessions = await this.sessionRepository.count({
        where: {
          mentorId,
          status: SESSION_STATUS.CONFIRMED,
        },
      });

      const upcomingSessionsCount = await this.sessionRepository
        .createQueryBuilder('session')
        .where('session.mentorId = :mentorId', { mentorId })
        .andWhere('session.scheduledAt > :now', { now: new Date() })
        .andWhere('session.status IN (:...statuses)', {
          statuses: [SESSION_STATUS.SCHEDULED, SESSION_STATUS.CONFIRMED],
        })
        .getCount();

      const upcomingSessions = upcomingSessionsCount;

      // Format today's sessions
      const formattedTodaysSessions = todaysSessions.map((session) => {
        const mentee = session.mentee;
        return {
          id: session.id,
          mentee: {
            id: mentee.id,
            name:
              mentee.firstName && mentee.lastName
                ? `${mentee.firstName} ${mentee.lastName}`
                : mentee.email || 'Unknown Mentee',
            avatar: profileMap.get(mentee.id) || undefined,
          },
          scheduledAt: session.scheduledAt,
          status: session.status,
          title: session.title,
          description: session.description,
        };
      });

      return {
        todaysSessions: formattedTodaysSessions,
        recentMentees,
        stats: {
          totalMentees,
          activeSessions,
          upcomingSessions,
        },
      };
    } catch (error) {
      this.logger.error(
        'Error getting mentor dashboard',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * Get mentees list for a mentor with pagination and search
   */
  async getMentees(
    mentorId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
    } = {}
  ): Promise<{
    mentees: MenteeListItem[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      pages: number;
    };
  }> {
    try {
      const { page = 1, limit = 20, search = '' } = options;
      const offset = (page - 1) * limit;

      // Get all sessions for this mentor to extract mentees
      let sessionsQuery = this.sessionRepository
        .createQueryBuilder('session')
        .leftJoinAndSelect('session.mentee', 'mentee')
        .where('session.mentorId = :mentorId', { mentorId })
        .andWhere('session.status != :cancelled', {
          cancelled: SESSION_STATUS.CANCELLED,
        });

      // Apply search filter if provided
      if (search) {
        sessionsQuery = sessionsQuery.andWhere(
          '(mentee.firstName LIKE :search OR mentee.lastName LIKE :search OR mentee.email LIKE :search)',
          { search: `%${search}%` }
        );
      }

      const allSessions = await sessionsQuery
        .orderBy('session.scheduledAt', 'DESC')
        .getMany();

      // Group sessions by mentee and calculate stats
      const menteeMap = new Map<string, MenteeListItem>();

      // Get mentee profiles for all sessions
      const sessionMenteeIds = [...new Set(allSessions.map((s) => s.menteeId))];
      const sessionMenteeProfiles = await this.menteeProfileRepository.find({
        where: sessionMenteeIds.map((id) => ({ userId: id })),
        select: ['userId', 'profileImage'],
      });
      const sessionProfileMap = new Map(
        sessionMenteeProfiles.map((p) => [p.userId, p.profileImage])
      );

      allSessions.forEach((session) => {
        const menteeId = session.menteeId;
        const mentee = session.mentee;

        if (!menteeMap.has(menteeId)) {
          menteeMap.set(menteeId, {
            id: menteeId,
            name:
              mentee.firstName && mentee.lastName
                ? `${mentee.firstName} ${mentee.lastName}`
                : mentee.email || 'Unknown Mentee',
            avatar: sessionProfileMap.get(menteeId) || undefined,
            email: mentee.email,
            lastSessionAt: session.scheduledAt,
            activeSessions: 0,
            totalSessions: 0,
          });
        }

        const menteeData = menteeMap.get(menteeId)!;
        menteeData.totalSessions++;

        // Update last session date if this is more recent
        if (
          session.scheduledAt &&
          (!menteeData.lastSessionAt ||
            new Date(session.scheduledAt) > new Date(menteeData.lastSessionAt))
        ) {
          menteeData.lastSessionAt = session.scheduledAt;
        }

        // Count active sessions (confirmed or scheduled)
        if (
          session.status === SESSION_STATUS.CONFIRMED ||
          session.status === SESSION_STATUS.SCHEDULED
        ) {
          menteeData.activeSessions++;
        }
      });

      // Convert to array and sort by last session date
      let mentees = Array.from(menteeMap.values()).sort((a, b) => {
        const dateA = a.lastSessionAt ? new Date(a.lastSessionAt).getTime() : 0;
        const dateB = b.lastSessionAt ? new Date(b.lastSessionAt).getTime() : 0;
        return dateB - dateA;
      });

      // Apply pagination
      const total = mentees.length;
      const pages = Math.ceil(total / limit);
      mentees = mentees.slice(offset, offset + limit);

      return {
        mentees,
        pagination: {
          total,
          page,
          limit,
          pages,
        },
      };
    } catch (error) {
      this.logger.error(
        'Error getting mentees',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * Get a specific mentee's details for a mentor
   */
  async getMenteeDetails(
    mentorId: string,
    menteeId: string
  ): Promise<MenteeListItem & { sessions: any[] }> {
    try {
      // Verify the mentee has sessions with this mentor
      const sessions = await this.sessionRepository
        .createQueryBuilder('session')
        .leftJoinAndSelect('session.mentee', 'mentee')
        .where('session.mentorId = :mentorId', { mentorId })
        .andWhere('session.menteeId = :menteeId', { menteeId })
        .orderBy('session.scheduledAt', 'DESC')
        .getMany();

      // Get mentee profile
      const menteeProfile = await this.menteeProfileRepository.findOne({
        where: { userId: menteeId },
        select: ['userId', 'profileImage'],
      });

      if (sessions.length === 0) {
        throw new AppError(
          'Mentee not found or no sessions with this mentor',
          StatusCodes.NOT_FOUND
        );
      }

      const mentee = sessions[0].mentee;

      const activeSessions = sessions.filter(
        (s) =>
          s.status === SESSION_STATUS.CONFIRMED ||
          s.status === SESSION_STATUS.SCHEDULED
      ).length;

      return {
        id: menteeId,
        name:
          mentee.firstName && mentee.lastName
            ? `${mentee.firstName} ${mentee.lastName}`
            : mentee.email || 'Unknown Mentee',
        avatar: menteeProfile?.profileImage || undefined,
        email: mentee.email,
        lastSessionAt: sessions[0].scheduledAt,
        activeSessions,
        totalSessions: sessions.length,
        sessions: sessions.map((s) => ({
          id: s.id,
          scheduledAt: s.scheduledAt,
          status: s.status,
          title: s.title,
          description: s.description,
        })),
      };
    } catch (error) {
      this.logger.error(
        'Error getting mentee details',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }
}
