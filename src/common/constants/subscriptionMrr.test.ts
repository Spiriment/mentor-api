import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  inferBillingIntervalFromProductId,
  mrrCentsFromRcEvent,
  mrrCentsFromStripeInvoice,
  stripePriceToMrrCents,
} from './subscriptionMrr';

describe('subscriptionMrr', () => {
  it('infers annual billing from RC product id', () => {
    assert.equal(
      inferBillingIntervalFromProductId('com.spiriment.mentor.pro.annual'),
      'annual',
    );
  });

  it('uses paid amount for RC MRR and normalizes annual to monthly', () => {
    const mrr = mrrCentsFromRcEvent({
      product_id: 'com.spiriment.mentor.pro.annual',
      price_in_purchased_currency: 120,
    });
    assert.equal(mrr, 1000);
  });

  it('converts annual stripe unit amount to monthly MRR', () => {
    assert.equal(stripePriceToMrrCents(12000, 'year'), 1000);
  });

  it('reads MRR from stripe invoice subscription line', () => {
    const mrr = mrrCentsFromStripeInvoice({
      lines: {
        data: [
          {
            type: 'subscription',
            amount: 1999,
            price: { recurring: { interval: 'month' } },
          },
        ],
      },
    });
    assert.equal(mrr, 1999);
  });
});
