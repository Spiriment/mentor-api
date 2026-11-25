/**
 * Who may use the /api/mentor-profiles and /api/mentee-profiles routes. These routes used to
 * have no authentication at all, so anyone could read or change any profile by its user id.
 */

/**
 * Older app builds don't refresh an expired access token on these routes (they're treated as
 * onboarding routes), so a mentor finishing onboarding a few days later would be locked out.
 * A recently expired token is accepted here only; the signature is still verified.
 */
export const PROFILE_TOKEN_GRACE_SECONDS = 30 * 24 * 60 * 60;

export type ProfileAccessRequest = {
  /** The signed-in user */
  viewer: { id: string; role?: string | null };
  /** The :userId in the URL */
  targetUserId: string;
  method: string;
  /** Path after the router's mount point, e.g. "/<id>" or "/<id>/profile-image" */
  path: string;
};

/**
 * Mentor profiles: only the owner (other people see mentors through /api/mentors).
 * Mentee profiles: the owner, and mentors reading the profile itself (MenteeProfileScreen).
 */
export function canAccessProfile(kind: 'mentor' | 'mentee', req: ProfileAccessRequest): boolean {
  if (req.viewer.id === req.targetUserId) return true;
  if (kind === 'mentee') {
    const readingProfile =
      req.method === 'GET' && req.path.replace(/\/+$/, '') === `/${req.targetUserId}`;
    return readingProfile && req.viewer.role === 'mentor';
  }
  return false;
}
