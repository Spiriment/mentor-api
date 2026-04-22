export const MENTOR_APPLICATION_TEMPLATE_IDS = [
  'mentor_application_approved_v1',
  'mentor_application_rejected_v1',
  'mentor_application_needs_more_info_v1',
] as const;

export type MentorApplicationTemplateId =
  (typeof MENTOR_APPLICATION_TEMPLATE_IDS)[number];

export const MENTOR_APPLICATION_TEMPLATES: Record<
  MentorApplicationTemplateId,
  { subject: string; body: string }
> = {
  mentor_application_approved_v1: {
    subject: 'Your Spiriment mentor application has been approved',
    body:
      'Congratulations — your mentor application has been approved. Open the Spiriment app to finish any remaining profile steps and start receiving session requests.',
  },
  mentor_application_rejected_v1: {
    subject: 'Update on your Spiriment mentor application',
    body:
      'Thank you for applying to mentor on Spiriment. We are unable to approve your application at this time. If you have questions, please contact support.',
  },
  mentor_application_needs_more_info_v1: {
    subject: 'More information needed for your mentor application',
    body:
      'We are reviewing your mentor application and need a bit more information before we can continue. Please open the Spiriment app to review the request and update your application.',
  },
};

export function resolveMentorApplicationTemplate(
  templateId: string | undefined,
  action: 'approve' | 'reject' | 'needs_more_info',
  dynamicTemplates?: Record<string, { subject: string; body: string }>
): { subject: string; body: string } {
  const mergedTemplates = { ...MENTOR_APPLICATION_TEMPLATES, ...dynamicTemplates };

  const byAction: Record<typeof action, MentorApplicationTemplateId> = {
    approve: 'mentor_application_approved_v1',
    reject: 'mentor_application_rejected_v1',
    needs_more_info: 'mentor_application_needs_more_info_v1',
  };

  if (
    templateId &&
    Object.keys(mergedTemplates).includes(templateId)
  ) {
    return mergedTemplates[templateId as MentorApplicationTemplateId] || mergedTemplates[byAction[action]];
  }

  return mergedTemplates[byAction[action]];
}
