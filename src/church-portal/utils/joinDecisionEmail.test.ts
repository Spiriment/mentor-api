import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildJoinDecisionEmail } from './joinDecisionEmail';

describe('buildJoinDecisionEmail', () => {
  it('words a rejection gently and addresses the member', () => {
    const mail = buildJoinDecisionEmail({ email: 'm@example.com', firstName: 'Ruth' }, 'Secret Place', false);
    assert.equal(mail.to, 'm@example.com');
    assert.equal(mail.subject, 'An update on your request to join Secret Place');
    assert.equal(mail.templateData.name, 'Ruth');
    assert.equal(mail.templateData.approved, false);
  });

  it('confirms an approval, and copes with no first name', () => {
    const mail = buildJoinDecisionEmail({ email: 'm@example.com' }, 'Secret Place', true);
    assert.equal(mail.subject, 'Your request to join Secret Place was approved');
    assert.equal(mail.templateData.name, 'there');
  });
});
