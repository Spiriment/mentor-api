import { AppDataSource } from '@/config/data-source';
import { Session, SESSION_STATUS } from '@/database/entities/session.entity';
import { User } from '@/database/entities/user.entity';
import { MenteeProfile } from '@/database/entities/menteeProfile.entity';
import { MentorshipRequest, MENTORSHIP_REQUEST_STATUS } from '@/database/entities/mentorshipRequest.entity';
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
  private mentorshipRequestRepository = AppDataSource.getRepository(MentorshipRequest);
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

      // Get count of accepted mentees
      const totalMentees = await this.mentorshipRequestRepository.count({
        where: {
          mentorId,
          status: MENTORSHIP_REQUEST_STATUS.ACCEPTED,
        },
      });

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

      // Get all accepted mentorship requests for this mentor
      let requestsQuery = this.mentorshipRequestRepository
        .createQueryBuilder('request')
        .leftJoinAndSelect('request.mentee', 'mentee')
        .where('request.mentorId = :mentorId', { mentorId })
        .andWhere('request.status = :accepted', {
          accepted: MENTORSHIP_REQUEST_STATUS.ACCEPTED,
        });

      // Apply search filter if provided
      if (search) {
        requestsQuery = requestsQuery.andWhere(
          '(mentee.firstName LIKE :search OR mentee.lastName LIKE :search OR mentee.email LIKE :search)',
          { search: `%${search}%` }
        );
      }

      // Get basic count for pagination
      const total = await requestsQuery.getCount();
      const pages = Math.ceil(total / limit);

      // Get paginated requests
      const requests = await requestsQuery
        .orderBy('mentee.firstName', 'ASC')
        .addOrderBy('mentee.lastName', 'ASC')
        .skip(offset)
        .take(limit)
        .getMany();

      if (requests.length === 0) {
        return {
          mentees: [],
          pagination: { total, page, limit, pages },
        };
      }

      const menteeIds = requests.map((r) => r.menteeId);

      // Fetch profiles for these mentees
      const profiles = await this.menteeProfileRepository.find({
        where: menteeIds.map((id) => ({ userId: id })),
      });
      const profileMap = new Map(profiles.map((p) => [p.userId, p]));

      // Fetch last session and session counts for these mentees
      const sessions = await this.sessionRepository
        .createQueryBuilder('session')
        .where('session.mentorId = :mentorId', { mentorId })
        .andWhere('session.menteeId IN (:...menteeIds)', { menteeIds })
        .andWhere('session.status != :cancelled', {
          cancelled: SESSION_STATUS.CANCELLED,
        })
        .orderBy('session.scheduledAt', 'DESC')
        .getMany();

      // Group sessions by mentee
      const sessionMap = new Map<string, Session[]>();
      sessions.forEach((s) => {
        const list = sessionMap.get(s.menteeId) || [];
        list.push(s);
        sessionMap.set(s.menteeId, list);
      });

      // Format the result
      const mentees: MenteeListItem[] = requests.map((request) => {
        const mentee = request.mentee!;
        const profile = profileMap.get(request.menteeId);
        const menteeSessions = sessionMap.get(request.menteeId) || [];

        const activeSessions = menteeSessions.filter(
          (s) =>
            s.status === SESSION_STATUS.CONFIRMED ||
            s.status === SESSION_STATUS.SCHEDULED
        ).length;

        return {
          id: request.menteeId,
          name:
            mentee.firstName && mentee.lastName
              ? `${mentee.firstName} ${mentee.lastName}`
              : mentee.email || 'Unknown Mentee',
          avatar: profile?.profileImage || undefined,
          email: mentee.email,
          lastSeen: mentee.lastActiveAt, // Use user's last activity
          lastSessionAt: menteeSessions[0]?.scheduledAt,
          activeSessions,
          totalSessions: menteeSessions.length,
        };
      });

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
