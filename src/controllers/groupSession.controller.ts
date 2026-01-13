import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { GroupSessionService } from '@/services/groupSession.service';
import {
  CreateGroupSessionDTO,
  RespondToInvitationDTO,
  GetGroupSessionsFilterDTO,
} from '@/dto/groupSession.dto';

export class GroupSessionController {
  private groupSessionService: GroupSessionService;

  constructor() {
    this.groupSessionService = new GroupSessionService();
  }

  /**
   * GET /api/sessions/group/eligible-mentees
   * Get list of mentees mentor has worked with
   */
  public getEligibleMentees = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const mentorId = req.user!.id;

      const mentees = await this.groupSessionService.getEligibleMentees(
        mentorId
      );

      res.status(200).json({
        success: true,
        data: mentees,
      });
    } catch (error: any) {
      console.error('Error fetching eligible mentees:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch eligible mentees',
      });
    }
  };

  /**
   * POST /api/sessions/group
   * Create group session and send invites
   */
  public createGroupSession = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const mentorId = req.user!.id;
      const data: CreateGroupSessionDTO = {
        ...req.body,
        mentorId,
      };

      const groupSession =
        await this.groupSessionService.createGroupSession(data);

      res.status(201).json({
        success: true,
        data: groupSession,
        message: 'Group session created and invitations sent successfully',
      });
    } catch (error: any) {
      console.error('Error creating group session:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to create group session',
      });
    }
  };

  /**
   * GET /api/sessions/group/:id
   * Get group session details
   */
  public getGroupSession = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const groupSession = await this.groupSessionService.getGroupSession(
        id,
        userId
      );

      res.status(200).json({
        success: true,
        data: groupSession,
      });
    } catch (error: any) {
      console.error('Error fetching group session:', error);
      const statusCode = error.message.includes('not found') ? 404 : 403;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to fetch group session',
      });
    }
  };

  /**
   * PUT /api/sessions/group/:id
   * Update group session (mentor only)
   */
  public updateGroupSession = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const mentorId = req.user!.id;
      const updates = req.body;

      const groupSession = await this.groupSessionService.updateGroupSession(
        id,
        mentorId,
        updates
      );

      res.status(200).json({
        success: true,
        data: groupSession,
        message: 'Group session updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating group session:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to update group session',
      });
    }
  };

  /**
   * DELETE /api/sessions/group/:id
   * Cancel group session
   */
  public cancelGroupSession = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const mentorId = req.user!.id;
      const { reason } = req.body;

      const groupSession = await this.groupSessionService.cancelGroupSession(
        id,
        mentorId,
        reason
      );

      res.status(200).json({
        success: true,
        data: groupSession,
        message: 'Group session cancelled successfully',
      });
    } catch (error: any) {
      console.error('Error cancelling group session:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to cancel group session',
      });
    }
  };

  /**
   * GET /api/sessions/group
   * Get mentor's group sessions
   */
  public getMentorGroupSessions = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const mentorId = req.user!.id;
      const filters: GetGroupSessionsFilterDTO = {
        status: req.query.status as any,
        upcoming: req.query.upcoming === 'true',
        past: req.query.past === 'true',
      };

      const groupSessions =
        await this.groupSessionService.getMentorGroupSessions(
          mentorId,
          filters
        );

      res.status(200).json({
        success: true,
        data: groupSessions,
      });
    } catch (error: any) {
      console.error('Error fetching mentor group sessions:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch group sessions',
      });
    }
  };

  /**
   * GET /api/sessions/group/invitations
   * Get mentee's group session invitations
   */
  public getMenteeInvitations = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const menteeId = req.user!.id;
      const filters = {
        status: req.query.status as any,
        upcoming: req.query.upcoming === 'true',
      };

      const invitations = await this.groupSessionService.getMenteeInvitations(
        menteeId,
        filters
      );

      res.status(200).json({
        success: true,
        data: invitations,
      });
    } catch (error: any) {
      console.error('Error fetching mentee invitations:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch invitations',
      });
    }
  };

  /**
   * PUT /api/sessions/group/:id/respond
   * Accept or decline group session invitation
   */
  public respondToInvitation = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const menteeId = req.user!.id;
      const { accept, declineReason } = req.body;

      const data: RespondToInvitationDTO = {
        groupSessionId: id,
        menteeId,
        accept,
        declineReason,
      };

      const participant =
        await this.groupSessionService.respondToInvitation(data);

      res.status(200).json({
        success: true,
        data: participant,
        message: accept
          ? 'Invitation accepted successfully'
          : 'Invitation declined',
      });
    } catch (error: any) {
      console.error('Error responding to invitation:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to respond to invitation',
      });
    }
  };

  /**
   * POST /api/sessions/group/:id/start
   * Start group session (mentor only)
   */
  public startGroupSession = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const mentorId = req.user!.id;

      const groupSession = await this.groupSessionService.startGroupSession(
        id,
        mentorId
      );

      res.status(200).json({
        success: true,
        data: groupSession,
        message: 'Group session started successfully',
      });
    } catch (error: any) {
      console.error('Error starting group session:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to start group session',
      });
    }
  };

  /**
   * POST /api/sessions/group/:id/end
   * End group session (mentor only)
   */
  public endGroupSession = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const mentorId = req.user!.id;

      const groupSession = await this.groupSessionService.endGroupSession(
        id,
        mentorId
      );

      res.status(200).json({
        success: true,
        data: groupSession,
        message: 'Group session ended successfully',
      });
    } catch (error: any) {
      console.error('Error ending group session:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to end group session',
      });
    }
  };

  /**
   * POST /api/sessions/group/:id/summary
   * Submit session summary (mentee only)
   */
  public submitSessionSummary = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const menteeId = req.user!.id;
      const { summary } = req.body;

      const participant =
        await this.groupSessionService.submitSessionSummary(
          id,
          menteeId,
          summary
        );

      res.status(200).json({
        success: true,
        data: participant,
        message: 'Session summary submitted successfully',
      });
    } catch (error: any) {
      console.error('Error submitting session summary:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to submit session summary',
      });
    }
  };

  /**
   * GET /api/sessions/group/:id/agora-credentials
   * Get Agora credentials for joining group video call
   */
  public getAgoraCredentials = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const credentials =
        await this.groupSessionService.getGroupSessionAgoraCredentials(
          id,
          userId
        );

      res.status(200).json({
        success: true,
        data: credentials,
      });
    } catch (error: any) {
      console.error('Error getting Agora credentials:', error);
      const statusCode = error.message.includes('not found')
        ? 404
        : error.message.includes('Unauthorized')
          ? 403
          : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to get Agora credentials',
      });
    }
  };

  /**
   * POST /api/sessions/group/:id/create-chat
   * Create a group chat for a completed group session
   */
  public createGroupChat = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const conversation = await this.groupSessionService.createGroupChat(
        id,
        userId
      );

      res.status(StatusCodes.CREATED).json({
        success: true,
        data: conversation,
      });
    } catch (error: any) {
      console.error('Error creating group chat:', error);
      const statusCode = error.message.includes('not found')
        ? StatusCodes.NOT_FOUND
        : error.message.includes('Bad Request') || error.message.includes('only be created for completed sessions')
          ? StatusCodes.BAD_REQUEST
          : StatusCodes.INTERNAL_SERVER_ERROR;

      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to create group chat',
      });
    }
  };
}
