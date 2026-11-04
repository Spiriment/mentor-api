/** The email telling a member what their pastor decided about their request to join */
export function buildJoinDecisionEmail(
  user: { email: string; firstName?: string | null },
  churchName: string,
  approved: boolean,
) {
  return {
    to: user.email,
    subject: approved
      ? `Your request to join ${churchName} was approved`
      : `An update on your request to join ${churchName}`,
    partialName: 'church-join-decision',
    templateData: { name: user.firstName || 'there', churchName, approved },
  };
}
