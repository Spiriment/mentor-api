import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { z } from 'zod';
import { errorHandler } from './errorHandler';

function run(error: Error) {
  const sent: { status?: number; body?: any } = {};
  const res: any = {
    status(code: number) {
      sent.status = code;
      return this;
    },
    json(body: unknown) {
      sent.body = body;
      return this;
    },
  };
  errorHandler({ error: () => undefined } as any)(error, { path: '/', method: 'POST', body: {} } as any, res, () => undefined);
  return sent;
}

describe('errorHandler', () => {
  it('reports bad input as a 400 with the message people should see', () => {
    const schema = z.object({ email: z.string().email('Enter a valid email address') });
    const { error } = schema.safeParse({ email: 'nope' }) as { error: z.ZodError };
    const sent = run(error);
    assert.equal(sent.status, 400);
    assert.equal(sent.body.error.message, 'Enter a valid email address');
    assert.deepEqual(sent.body.error.details, [{ field: 'email', message: 'Enter a valid email address' }]);
  });

  it('still hides the details of unexpected errors', () => {
    const sent = run(new Error('secret database detail'));
    assert.equal(sent.status, 500);
    assert.equal(sent.body.error.message, 'Internal server error');
  });
});
