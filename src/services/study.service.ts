import { DataSource, Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { StudyProgress } from '@/database/entities/studyProgress.entity';
import { StudySession } from '@/database/entities/studySession.entity';
import { StudyReflection } from '@/database/entities/studyReflection.entity';

export class StudyService {
  private progressRepo: Repository<StudyProgress>;
  private sessionRepo: Repository<StudySession>;
  private reflectionRepo: Repository<StudyReflection>;

  constructor(private dataSource: DataSource) {
    this.progressRepo = dataSource.getRepository(StudyProgress);
    this.sessionRepo = dataSource.getRepository(StudySession);
    this.reflectionRepo = dataSource.getRepository(StudyReflection);
  }

  async getProgress(userId: string): Promise<StudyProgress | null> {
    const progress = await this.progressRepo.findOne({ where: { userId } });
    // Ensure all required fields have default values if progress exists but fields are null
    if (progress) {
      return {
        ...progress,
        currentBookIndex: progress.currentBookIndex ?? 0,
        currentChapterIndex: progress.currentChapterIndex ?? 0,
        completedChapters: progress.completedChapters ?? [],
        currentDay: progress.currentDay ?? 1,
        totalDays: progress.totalDays ?? 0,
        lastStudiedAt: progress.lastStudiedAt ?? undefined, // Preserve lastStudiedAt
      };
    }
    return null;
  }

  async upsertProgress(
    progress: Partial<StudyProgress> & { userId: string }
  ): Promise<StudyProgress> {
    const existing = await this.getProgress(progress.userId);
    
    // If lastStudiedAt is not explicitly provided in the update,
    // set it to the current time (any progress update means the user has studied)
    const updateData: Partial<StudyProgress> = {
      ...progress,
    };
    
    // Always update lastStudiedAt when progress is updated, unless explicitly provided
    if (!updateData.lastStudiedAt) {
      updateData.lastStudiedAt = new Date();
    }
    
    if (existing) {
      const merged = this.progressRepo.merge(existing, updateData);
      return this.progressRepo.save(merged);
    }
    return this.progressRepo.save(this.progressRepo.create(updateData));
  }

  async addSession(
    session: Omit<StudySession, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<StudySession> {
    const entity = this.sessionRepo.create(session as any);
    const saved = await this.sessionRepo.save(entity);
    return (Array.isArray(saved) ? saved[0] : saved) as StudySession;
  }

  async listSessions(userId: string): Promise<StudySession[]> {
    return this.sessionRepo.find({
      where: { userId },
      order: { completedAt: 'DESC' },
    });
  }

  async addReflection(
    reflection: Omit<StudyReflection, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<StudyReflection> {
    const entity = this.reflectionRepo.create(reflection as any);
    const saved = await this.reflectionRepo.save(entity);
    return (Array.isArray(saved) ? saved[0] : saved) as StudyReflection;
  }

  async listReflections(
    userId: string,
    options?: {
      book?: string;
      page?: number;
      limit?: number;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<{
    reflections: StudyReflection[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = { userId };
    if (options?.book) {
      where.book = options.book;
    }
    if (options?.startDate && options?.endDate) {
      where.createdAt = Between(new Date(options.startDate), new Date(options.endDate));
    } else if (options?.startDate) {
      where.createdAt = MoreThanOrEqual(new Date(options.startDate));
    } else if (options?.endDate) {
      where.createdAt = LessThanOrEqual(new Date(options.endDate));
    }

    // Get total count
    const total = await this.reflectionRepo.count({ where });

    // Get paginated reflections
    const reflections = await this.reflectionRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip,
    });

    return {
      reflections,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // Get distinct books for filter dropdown
  async getReflectionBooks(userId: string): Promise<string[]> {
    const reflections = await this.reflectionRepo.find({
      where: { userId },
      select: ['book'],
    });

    // Get unique books
    const books = Array.from(new Set(reflections.map(r => r.book)));
    return books.sort();
  }

  async updateReflection(
    userId: string,
    reflectionId: string,
    data: Partial<Pick<StudyReflection, 'content'>>
  ): Promise<StudyReflection | null> {
    const reflection = await this.reflectionRepo.findOne({
      where: { id: reflectionId, userId },
    });

    if (!reflection) return null;

    const updated = this.reflectionRepo.merge(reflection, data);
    return this.reflectionRepo.save(updated);
  }

  async deleteReflection(userId: string, reflectionId: string): Promise<boolean> {
    const result = await this.reflectionRepo.delete({
      id: reflectionId,
      userId,
    });
    return (result.affected || 0) > 0;
  }
}
