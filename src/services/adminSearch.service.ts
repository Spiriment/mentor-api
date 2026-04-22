import { Brackets } from 'typeorm';
import { AppDataSource } from '@/config/data-source';
import { User } from '@/database/entities/user.entity';
import { MentorProfile } from '@/database/entities/mentorProfile.entity';
import { USER_ROLE, MENTOR_APPROVAL_STATUS } from '@/common';

export type GlobalSearchResult = {
  users: Array<{
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
  }>;
  mentors: Array<{
    id: string;
    userId: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    churchAffiliation: string | null;
  }>;
  applications: Array<{
    id: string;
    userId: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    status: string;
  }>;
};

export class AdminSearchService {
  async globalSearch(term: string): Promise<GlobalSearchResult> {
    const cleanTerm = term.trim().replace(/[%_\\]/g, '');
    if (cleanTerm.length < 2) {
      return { users: [], mentors: [], applications: [] };
    }
    const searchPattern = `%${cleanTerm}%`;

    const [users, mentorProfiles] = await Promise.all([
      this.searchUsers(searchPattern),
      this.searchMentorProfiles(searchPattern),
    ]);

    // Separate mentors from applications
    const mentors: GlobalSearchResult['mentors'] = [];
    const applications: GlobalSearchResult['applications'] = [];

    mentorProfiles.forEach((mp) => {
      if (mp.isApproved) {
        mentors.push({
          id: mp.id,
          userId: mp.userId,
          email: mp.user.email,
          firstName: mp.user.firstName ?? null,
          lastName: mp.user.lastName ?? null,
          churchAffiliation: mp.churchAffiliation ?? null,
        });
      } else if (mp.isOnboardingComplete) {
        applications.push({
          id: mp.id,
          userId: mp.userId,
          email: mp.user.email,
          firstName: mp.user.firstName ?? null,
          lastName: mp.user.lastName ?? null,
          status: mp.user.mentorApprovalStatus || 'pending_review',
        });
      }
    });

    return {
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName ?? null,
        lastName: u.lastName ?? null,
        role: u.role || 'unknown',
      })),
      mentors,
      applications,
    };
  }

  private async searchUsers(pattern: string) {
    return AppDataSource.getRepository(User)
      .createQueryBuilder('u')
      .where('u.role = :role', { role: USER_ROLE.MENTEE })
      .andWhere(
        new Brackets((qb) => {
          qb.where('u.email LIKE :s', { s: pattern })
            .orWhere('u.firstName LIKE :s', { s: pattern })
            .orWhere('u.lastName LIKE :s', { s: pattern });
        })
      )
      .take(5)
      .getMany();
  }

  private async searchMentorProfiles(pattern: string) {
    return AppDataSource.getRepository(MentorProfile)
      .createQueryBuilder('mp')
      .innerJoinAndSelect('mp.user', 'user')
      .where(
        new Brackets((qb) => {
          qb.where('user.email LIKE :s', { s: pattern })
            .orWhere('user.firstName LIKE :s', { s: pattern })
            .orWhere('user.lastName LIKE :s', { s: pattern })
            .orWhere('mp.churchAffiliation LIKE :s', { s: pattern });
        })
      )
      .take(10)
      .getMany();
  }
}

export const adminSearchService = new AdminSearchService();
