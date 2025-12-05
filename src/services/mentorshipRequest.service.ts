import { Repository } from 'typeorm';
import { AppDataSource } from '../config/data-source';
import {
  MentorshipRequest,
  MENTORSHIP_REQUEST_STATUS,
} from '../database/entities/mentorshipRequest.entity';
import { User } from '../database/entities/user.entity';
import { AppNotificationService } from './appNotification.service';
import { AppNotificationType } from '../database/entities/appNotification.entity';
import { logger } from '@/config/int-services';
import { getEmailService } from '@/services';
import { pushNotificationService } from './pushNotification.service';

export class MentorshipRequestService {
  private requestRepository: Repository<MentorshipRequest>;
  private userRepository: Repository<User>;
  private notificationService: AppNotificationService;

  constructor() {
    this.requestRepository = AppDataSource.getRepository(MentorshipRequest);
    this.userRepository = AppDataSource.getRepository(User);
    this.notificationService = new AppNotificationService();
  }

  /**
   * Create a mentorship request from mentee to mentor
   */
  async createRequest(data: {
    mentorId: string;
    menteeId: string;
    message?: string;
  }): Promise<MentorshipRequest> {
    try {
      // Check if request already exists
      const existingRequest = await this.requestRepository.findOne({
        where: {
          mentorId: data.mentorId,
          menteeId: data.menteeId,
        },
      });

      if (existingRequest) {
        // If there's a pending request, return it
        if (existingRequest.status === MENTORSHIP_REQUEST_STATUS.PENDING) {
          throw new Error('You already have a pending mentorship request with this mentor.');
        }
        // If there's an accepted request, throw error
        if (existingRequest.status === MENTORSHIP_REQUEST_STATUS.ACCEPTED) {
          throw new Error('You already have an active mentorship with this mentor.');
        }
        // If declined or cancelled, allow creating a new request
        if (
          existingRequest.status === MENTORSHIP_REQUEST_STATUS.DECLINED ||
          existingRequest.status === MENTORSHIP_REQUEST_STATUS.CANCELLED
        ) {
          // Update the existing request instead of creating new one
          existingRequest.status = MENTORSHIP_REQUEST_STATUS.PENDING;
          existingRequest.message = data.message;
          existingRequest.responseMessage = undefined;
          existingRequest.respondedAt = undefined;
          await this.requestRepository.save(existingRequest);

          // Send notifications for renewed request
          await this.sendRequestNotifications(existingRequest);

          return existingRequest;
        }
      }

      // Get mentor and mentee details
      const [mentor, mentee] = await Promise.all([
        this.userRepository.findOne({ where: { id: data.mentorId } }),
        this.userRepository.findOne({ where: { id: data.menteeId } }),
      ]);

      if (!mentor) {
        throw new Error('Mentor not found');
      }

      if (!mentee) {
        throw new Error('Mentee not found');
      }

      // Create the request
      const request = this.requestRepository.create({
        mentorId: data.mentorId,
        menteeId: data.menteeId,
        message: data.message,
        status: MENTORSHIP_REQUEST_STATUS.PENDING,
      });

      const savedRequest = await this.requestRepository.save(request);

      logger.info('Mentorship request created', {
        requestId: savedRequest.id,
        mentorId: data.mentorId,
        menteeId: data.menteeId,
      });

      // Send notifications and email
      await this.sendRequestNotifications(savedRequest);

      return savedRequest;
    } catch (error: any) {
      logger.error('Error creating mentorship request', error);
      throw error;
    }
  }

  /**
   * Send notifications and email for a mentorship request
   */
  private async sendRequestNotifications(request: MentorshipRequest): Promise<void> {
    try {
      // Get mentor and mentee details
      const [mentor, mentee] = await Promise.all([
        this.userRepository.findOne({ where: { id: request.mentorId } }),
        this.userRepository.findOne({ where: { id: request.menteeId } }),
      ]);

      if (!mentor || !mentee) {
        logger.error('Mentor or mentee not found for notifications');
        return;
      }

      const menteeName = `${mentee.firstName} ${mentee.lastName}`;

      // Create in-app notification for mentor
      await this.notificationService.createNotification({
        userId: request.mentorId,
        type: AppNotificationType.MENTORSHIP_REQUEST,
        title: `New Mentorship Request from ${menteeName}`,
        message: request.message
          ? `${menteeName} wants you to be their mentor: "${request.message}"`
          : `${menteeName} wants you to be their mentor.`,
        data: {
          requestId: request.id,
          menteeId: request.menteeId,
          menteeName,
        },
      });

      // Send email to mentor
      const emailService = getEmailService();
      if (emailService) {
        await emailService.sendEmailWithTemplate({
          to: mentor.email,
          subject: `New Mentorship Request from ${menteeName}`,
          partialName: 'mentorship-request',
          templateData: {
            mentorName: `${mentor.firstName} ${mentor.lastName}`,
            menteeName,
            message: request.message || 'I would love to have you as my mentor.',
            requestId: request.id,
          },
        });
      }

      // Send push notification to mentor
      if (mentor.pushToken) {
        await pushNotificationService.sendMentorshipRequestNotification(
          mentor.pushToken,
          mentor.id,
          menteeName
        );
        logger.info('Push notification sent to mentor for mentorship request', {
          requestId: request.id,
          mentorId: mentor.id,
        });
      }

      logger.info('Mentorship request notifications sent', {
        requestId: request.id,
        mentorEmail: mentor.email,
      });
    } catch (error: any) {
      logger.error('Error sending mentorship request notifications', error);
      // Don't throw error, as request is already created
    }
  }

  /**
   * Accept a mentorship request
   */
  async acceptRequest(requestId: string, mentorId: string, responseMessage?: string): Promise<MentorshipRequest> {
    try {
      const request = await this.requestRepository.findOne({
        where: { id: requestId, mentorId },
      });

      if (!request) {
        throw new Error('Mentorship request not found');
      }

      if (!request.canRespond()) {
        throw new Error('This request has already been responded to');
      }

      // Update request status
      request.status = MENTORSHIP_REQUEST_STATUS.ACCEPTED;
      request.responseMessage = responseMessage;
      request.respondedAt = new Date();

      const savedRequest = await this.requestRepository.save(request);

      logger.info('Mentorship request accepted', {
        requestId,
        mentorId,
      });

      // Send notifications
      await this.sendAcceptanceNotifications(savedRequest);

      return savedRequest;
    } catch (error: any) {
      logger.error('Error accepting mentorship request', error);
      throw error;
    }
  }

  /**
   * Send notifications and email for accepted mentorship request
   */
  private async sendAcceptanceNotifications(request: MentorshipRequest): Promise<void> {
    try {
      const [mentor, mentee] = await Promise.all([
        this.userRepository.findOne({ where: { id: request.mentorId } }),
        this.userRepository.findOne({ where: { id: request.menteeId } }),
      ]);

      if (!mentor || !mentee) {
        logger.error('Mentor or mentee not found for notifications');
        return;
      }

      const mentorName = `${mentor.firstName} ${mentor.lastName}`;

      // Create in-app notification for mentee
      await this.notificationService.createNotification({
        userId: request.menteeId,
        type: AppNotificationType.MENTORSHIP_ACCEPTED,
        title: `${mentorName} Accepted Your Request!`,
        message: request.responseMessage
          ? `${mentorName} accepted your mentorship request: "${request.responseMessage}"`
          : `${mentorName} accepted your mentorship request. You can now message them and schedule sessions!`,
        data: {
          requestId: request.id,
          mentorId: request.mentorId,
          mentorName,
        },
      });

      // Send email to mentee
      const emailService = getEmailService();
      if (emailService) {
        await emailService.sendEmailWithTemplate({
          to: mentee.email,
          subject: `${mentorName} Accepted Your Mentorship Request!`,
          partialName: 'mentorship-accepted',
          templateData: {
            menteeName: `${mentee.firstName} ${mentee.lastName}`,
            mentorName,
            responseMessage: request.responseMessage || 'I look forward to mentoring you!',
            requestId: request.id,
          },
        });
      }

      // Send push notification to mentee
      if (mentee.pushToken) {
        await pushNotificationService.sendMentorshipAcceptedNotification(
          mentee.pushToken,
          mentee.id,
          mentorName
        );
        logger.info('Push notification sent to mentee for mentorship acceptance', {
          requestId: request.id,
          menteeId: mentee.id,
        });
      }

      logger.info('Mentorship acceptance notifications sent', {
        requestId: request.id,
        menteeEmail: mentee.email,
      });
    } catch (error: any) {
      logger.error('Error sending acceptance notifications', error);
    }
  }

  /**
   * Decline a mentorship request
   */
  async declineRequest(requestId: string, mentorId: string, responseMessage?: string): Promise<MentorshipRequest> {
    try {
      const request = await this.requestRepository.findOne({
        where: { id: requestId, mentorId },
      });

      if (!request) {
        throw new Error('Mentorship request not found');
      }

      if (!request.canRespond()) {
        throw new Error('This request has already been responded to');
      }

      // Update request status
      request.status = MENTORSHIP_REQUEST_STATUS.DECLINED;
      request.responseMessage = responseMessage;
      request.respondedAt = new Date();

      const savedRequest = await this.requestRepository.save(request);

      logger.info('Mentorship request declined', {
        requestId,
        mentorId,
      });

      // Send notifications
      await this.sendDeclineNotifications(savedRequest);

      return savedRequest;
    } catch (error: any) {
      logger.error('Error declining mentorship request', error);
      throw error;
    }
  }

  /**
   * Send notifications and email for declined mentorship request
   */
  private async sendDeclineNotifications(request: MentorshipRequest): Promise<void> {
    try {
      const [mentor, mentee] = await Promise.all([
        this.userRepository.findOne({ where: { id: request.mentorId } }),
        this.userRepository.findOne({ where: { id: request.menteeId } }),
      ]);

      if (!mentor || !mentee) {
        logger.error('Mentor or mentee not found for notifications');
        return;
      }

      const mentorName = `${mentor.firstName} ${mentor.lastName}`;

      // Create in-app notification for mentee
      await this.notificationService.createNotification({
        userId: request.menteeId,
        type: AppNotificationType.MENTORSHIP_DECLINED,
        title: `Mentorship Request Response from ${mentorName}`,
        message: request.responseMessage
          ? `${mentorName} is unable to accept your mentorship request: "${request.responseMessage}"`
          : `${mentorName} is unable to accept your mentorship request at this time.`,
        data: {
          requestId: request.id,
          mentorId: request.mentorId,
          mentorName,
        },
      });

      // Send email to mentee
      const emailService = getEmailService();
      if (emailService) {
        await emailService.sendEmailWithTemplate({
          to: mentee.email,
          subject: `Mentorship Request Update from ${mentorName}`,
          partialName: 'mentorship-declined',
          templateData: {
            menteeName: `${mentee.firstName} ${mentee.lastName}`,
            mentorName,
            responseMessage:
              request.responseMessage ||
              'Unfortunately, I am unable to accept new mentees at this time. Please consider reaching out to other mentors.',
            requestId: request.id,
          },
        });
      }

      // Send push notification to mentee
      if (mentee.pushToken) {
        await pushNotificationService.sendMentorshipDeclinedNotification(
          mentee.pushToken,
          mentee.id,
          mentorName
        );
        logger.info('Push notification sent to mentee for mentorship decline', {
          requestId: request.id,
          menteeId: mentee.id,
        });
      }

      logger.info('Mentorship decline notifications sent', {
        requestId: request.id,
        menteeEmail: mentee.email,
      });
    } catch (error: any) {
      logger.error('Error sending decline notifications', error);
    }
  }

  /**
   * Cancel a mentorship request (by mentee)
   */
  async cancelRequest(requestId: string, menteeId: string): Promise<MentorshipRequest> {
    try {
      const request = await this.requestRepository.findOne({
        where: { id: requestId, menteeId },
      });

      if (!request) {
        throw new Error('Mentorship request not found');
      }

      if (!request.canCancel()) {
        throw new Error('This request can no longer be cancelled');
      }

      request.status = MENTORSHIP_REQUEST_STATUS.CANCELLED;
      const savedRequest = await this.requestRepository.save(request);

      logger.info('Mentorship request cancelled', {
        requestId,
        menteeId,
      });

      return savedRequest;
    } catch (error: any) {
      logger.error('Error cancelling mentorship request', error);
      throw error;
    }
  }

  /**
   * Get mentorship request status between mentor and mentee
   */
  async getRequestStatus(mentorId: string, menteeId: string): Promise<MentorshipRequest | null> {
    try {
      const request = await this.requestRepository.findOne({
        where: {
          mentorId,
          menteeId,
        },
        order: {
          createdAt: 'DESC',
        },
      });

      return request;
    } catch (error: any) {
      logger.error('Error getting request status', error);
      throw error;
    }
  }

  /**
   * Get all mentorship requests for a mentor
   */
  async getMentorRequests(mentorId: string, status?: MENTORSHIP_REQUEST_STATUS): Promise<MentorshipRequest[]> {
    try {
      const queryBuilder = this.requestRepository
        .createQueryBuilder('request')
        .leftJoinAndSelect('request.mentee', 'mentee')
        .where('request.mentorId = :mentorId', { mentorId })
        .orderBy('request.createdAt', 'DESC');

      if (status) {
        queryBuilder.andWhere('request.status = :status', { status });
      }

      return await queryBuilder.getMany();
    } catch (error: any) {
      logger.error('Error getting mentor requests', error);
      throw error;
    }
  }

  /**
   * Get all mentorship requests for a mentee
   */
  async getMenteeRequests(menteeId: string, status?: MENTORSHIP_REQUEST_STATUS): Promise<MentorshipRequest[]> {
    try {
      const queryBuilder = this.requestRepository
        .createQueryBuilder('request')
        .leftJoinAndSelect('request.mentor', 'mentor')
        .where('request.menteeId = :menteeId', { menteeId })
        .orderBy('request.createdAt', 'DESC');

      if (status) {
        queryBuilder.andWhere('request.status = :status', { status });
      }

      return await queryBuilder.getMany();
    } catch (error: any) {
      logger.error('Error getting mentee requests', error);
      throw error;
    }
  }

  /**
   * Check if mentee has active mentorship with mentor
   */
  async hasActiveMentorship(mentorId: string, menteeId: string): Promise<boolean> {
    try {
      const request = await this.requestRepository.findOne({
        where: {
          mentorId,
          menteeId,
          status: MENTORSHIP_REQUEST_STATUS.ACCEPTED,
        },
      });

      return !!request;
    } catch (error: any) {
      logger.error('Error checking active mentorship', error);
      throw error;
    }
  }
}
