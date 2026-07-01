import { Brackets } from 'typeorm';
import { AppDataSource } from '@/config/data-source';
import {
  SupportTicket,
  SupportTicketMessage,
  SupportTicketPriority,
  SupportTicketStatus,
  SupportTicketType,
} from '@/database/entities/supportTicket.entity';
import { User } from '@/database/entities/user.entity';
import { AppError } from '@/common';

const DEFAULT_PAGE = 1;
const MAX_LIMIT = 100;

const TYPE_LABELS: Record<SupportTicketType, string> = {
  technical_issue: 'Technical Issue',
  billing: 'Billing',
  mentor_complaint: 'Mentor Complaint',
  feature_request: 'Feature Request',
  other: 'Other',
};

const STATUS_LABELS: Record<SupportTicketStatus, string> = {
  open: 'Open',
  pending: 'Pending',
  resolved: 'Resolved',
};

const PRIORITY_LABELS: Record<SupportTicketPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

function formatDate(value: Date): string {
  return value.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(value: Date): string {
  return value.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function serializeMessage(message: SupportTicketMessage) {
  return {
    id: message.id,
    author: message.authorName,
    date: formatDateTime(message.createdAt),
    text: message.text,
    isInternal: message.isInternal,
    createdAt: message.createdAt.toISOString(),
  };
}

function serializeTicket(
  ticket: SupportTicket,
  includeMessages = false
) {
  const base = {
    id: ticket.id,
    subject: ticket.subject,
    userName: ticket.userName,
    userEmail: ticket.userEmail,
    linkedMentor: ticket.linkedMentorName ?? undefined,
    linkedMentorId: ticket.linkedMentorId ?? undefined,
    type: TYPE_LABELS[ticket.type] ?? ticket.type,
    typeKey: ticket.type,
    priority: PRIORITY_LABELS[ticket.priority] ?? ticket.priority,
    priorityKey: ticket.priority,
    status: STATUS_LABELS[ticket.status] ?? ticket.status,
    statusKey: ticket.status,
    createdDate: formatDate(ticket.createdAt),
    lastUpdated: formatDate(ticket.updatedAt),
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  };

  if (includeMessages) {
    return {
      ...base,
      messages: (ticket.messages ?? [])
        .slice()
        .sort(
          (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
        )
        .map(serializeMessage),
    };
  }

  return base;
}

export class AdminSupportService {
  private ticketRepo = AppDataSource.getRepository(SupportTicket);
  private messageRepo = AppDataSource.getRepository(SupportTicketMessage);
  private userRepo = AppDataSource.getRepository(User);

  async listTickets(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: SupportTicketStatus | 'all';
    priority?: SupportTicketPriority | 'all';
  }) {
    const page = Math.max(1, params.page ?? DEFAULT_PAGE);
    const limit = Math.min(MAX_LIMIT, Math.max(1, params.limit ?? 50));
    const skip = (page - 1) * limit;

    const qb = this.ticketRepo
      .createQueryBuilder('ticket')
      .orderBy('ticket.updatedAt', 'DESC');

    if (params.status && params.status !== 'all') {
      qb.andWhere('ticket.status = :status', { status: params.status });
    }

    if (params.priority && params.priority !== 'all') {
      qb.andWhere('ticket.priority = :priority', { priority: params.priority });
    }

    if (params.search?.trim()) {
      const term = `%${params.search.trim()}%`;
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('ticket.subject LIKE :term', { term })
            .orWhere('ticket.userName LIKE :term', { term })
            .orWhere('ticket.userEmail LIKE :term', { term });
        })
      );
    }

    const [rows, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return {
      data: rows.map((ticket) => serializeTicket(ticket)),
      pagination: { total, page, limit },
    };
  }

  async getTicketById(id: string) {
    const ticket = await this.ticketRepo.findOne({
      where: { id },
      relations: ['messages'],
    });

    if (!ticket) {
      throw new AppError('Support ticket not found', 404);
    }

    return serializeTicket(ticket, true);
  }

  async updateTicket(
    id: string,
    updates: {
      status?: SupportTicketStatus;
      priority?: SupportTicketPriority;
    }
  ) {
    const ticket = await this.ticketRepo.findOne({ where: { id } });
    if (!ticket) {
      throw new AppError('Support ticket not found', 404);
    }

    if (updates.status) ticket.status = updates.status;
    if (updates.priority) ticket.priority = updates.priority;

    const saved = await this.ticketRepo.save(ticket);
    return serializeTicket(saved);
  }

  async addMessage(
    ticketId: string,
    adminUserId: string,
    adminDisplayName: string,
    body: { text: string; isInternal?: boolean }
  ) {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
    if (!ticket) {
      throw new AppError('Support ticket not found', 404);
    }

    const message = this.messageRepo.create({
      ticketId,
      authorName: adminDisplayName,
      adminUserId,
      text: body.text,
      isInternal: body.isInternal ?? false,
    });

    await this.messageRepo.save(message);

    if (ticket.status === 'open' && !body.isInternal) {
      ticket.status = 'pending';
      await this.ticketRepo.save(ticket);
    } else {
      await this.ticketRepo.update(ticketId, { updatedAt: new Date() });
    }

    return this.getTicketById(ticketId);
  }

  async createTicketForUser(
    userId: string,
    body: {
      subject: string;
      message: string;
      type?: SupportTicketType;
      priority?: SupportTicketPriority;
      linkedMentorId?: string | null;
    }
  ) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new AppError('User not found', 404);
    }

    let linkedMentorName: string | null = null;
    if (body.linkedMentorId) {
      const mentor = await this.userRepo.findOne({
        where: { id: body.linkedMentorId },
      });
      if (mentor) {
        linkedMentorName =
          [mentor.firstName, mentor.lastName].filter(Boolean).join(' ') ||
          mentor.email;
      }
    }

    const displayName =
      [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;

    const ticket = this.ticketRepo.create({
      subject: body.subject,
      userId: user.id,
      userName: displayName,
      userEmail: user.email,
      linkedMentorId: body.linkedMentorId ?? null,
      linkedMentorName,
      type: body.type ?? 'other',
      priority: body.priority ?? 'medium',
      status: 'open',
    });

    const savedTicket = await this.ticketRepo.save(ticket);

    const initialMessage = this.messageRepo.create({
      ticketId: savedTicket.id,
      authorName: displayName,
      text: body.message,
      isInternal: false,
    });

    await this.messageRepo.save(initialMessage);

    return this.getTicketForUser(userId, savedTicket.id);
  }

  async listUserTickets(userId: string, page = 1, limit = 20) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(50, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const [rows, total] = await this.ticketRepo.findAndCount({
      where: { userId },
      order: { updatedAt: 'DESC' },
      skip,
      take: safeLimit,
    });

    return {
      data: rows.map((ticket) => serializeTicket(ticket)),
      pagination: { total, page: safePage, limit: safeLimit },
    };
  }

  async getTicketForUser(userId: string, ticketId: string) {
    const ticket = await this.ticketRepo.findOne({
      where: { id: ticketId, userId },
      relations: ['messages'],
    });

    if (!ticket) {
      throw new AppError('Support ticket not found', 404);
    }

    ticket.messages = (ticket.messages ?? []).filter((m) => !m.isInternal);
    return serializeTicket(ticket, true);
  }

  async addUserMessage(userId: string, ticketId: string, text: string) {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId, userId } });
    if (!ticket) {
      throw new AppError('Support ticket not found', 404);
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    const authorName =
      [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
      user?.email ||
      'User';

    const message = this.messageRepo.create({
      ticketId,
      authorName,
      text,
      isInternal: false,
    });

    await this.messageRepo.save(message);

    if (ticket.status === 'resolved') {
      ticket.status = 'open';
    }
    ticket.updatedAt = new Date();
    await this.ticketRepo.save(ticket);

    return this.getTicketForUser(userId, ticketId);
  }
}

export const adminSupportService = new AdminSupportService();
