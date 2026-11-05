/** Stops a pastor locking themselves out, or leaving the church with no active pastor */
export function assertCanChangeTeamMember(
  actorId: string,
  targetId: string,
  ErrorType: new (message: string) => Error,
): void {
  if (actorId === targetId) {
    throw new ErrorType("You can't change your own role or access. Ask another pastor or Spiriment.");
  }
}
