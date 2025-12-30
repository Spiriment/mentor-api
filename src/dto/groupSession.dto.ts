import { GROUP_SESSION_STATUS, GROUP_SESSION_DURATION } from '@/database/entities/groupSession.entity';
import { INVITATION_STATUS } from '@/database/entities/groupSessionParticipant.entity';

export interface CreateGroupSessionDTO {
  mentorId: string;
  title: string;
  description?: string;
  scheduledAt: Date;
  duration: GROUP_SESSION_DURATION;
  maxParticipants?: number;
  menteeIds: string[]; // Array of mentee IDs to invite
}

export interface UpdateGroupSessionDTO {
  title?: string;
  description?: string;
  scheduledAt?: Date;
  duration?: GROUP_SESSION_DURATION;
  maxParticipants?: number;
}

export interface RespondToInvitationDTO {
  groupSessionId: string;
  menteeId: string;
  accept: boolean;
  declineReason?: string;
}

export interface GetGroupSessionsFilterDTO {
  status?: GROUP_SESSION_STATUS;
  upcoming?: boolean;
  past?: boolean;
}

export interface GetInvitationsFilterDTO {
  status?: INVITATION_STATUS;
  upcoming?: boolean;
}
