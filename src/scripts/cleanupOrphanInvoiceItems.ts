/**
 * One-off: find church/family central-invoice line items left "pending" on Stripe customers.
 *
 * Before the createAndSendInvoice fix, every central invoice was created empty and its line
 * items stayed pending on the customer. Stripe adds pending items to that customer's NEXT
 * invoice, which for an app user with a subscription means their renewal.
 *
 *   npm run cleanup:invoice-items          → dry run: lists what would be deleted
 *   npm run cleanup:invoice-items:apply    → deletes those pending items
 *
 * Only pending, one-off items (no subscription) whose description matches the central invoice
 * lines are touched. Review the dry run first. Safe to run more than once.
 */
import 'reflect-metadata';
import '@/config';
import { stripeService } from '@/services/stripe.service';

const APPLY = process.argv.includes('--apply');

// Line descriptions written by buildChurchInvoiceDraft / generateFamilyInvoice
const CENTRAL_INVOICE_LINE = [
  /^Church portal dashboard — monthly access \(€\d+\)$/,
  / — (basic|pro|premium) \(\d+% church discount\)$/,
  / — (basic|pro|premium)( \(\d+% youth discount\))?$/,
];

async function main() {
  const stripe = stripeService.stripe;
  console.log(`${APPLY ? 'APPLYING' : 'DRY RUN (nothing will be deleted)'}: pending central-invoice items\n`);

  let found = 0;
  let deleted = 0;
  let totalCents = 0;
  for await (const item of stripe.invoiceItems.list({ pending: true, limit: 100 })) {
    const fromCentralInvoice =
      item.metadata?.source === 'central_invoice' ||
      (!!item.description && CENTRAL_INVOICE_LINE.some((re) => re.test(item.description!)));
    // Subscription items (prorations etc.) belong to the member's own billing: never touch them
    if (!fromCentralInvoice || item.parent?.subscription_details) continue;

    found++;
    totalCents += item.amount;
    const customerId = typeof item.customer === 'string' ? item.customer : item.customer?.id;
    const customer = customerId ? await stripe.customers.retrieve(customerId) : null;
    const email = customer && !('deleted' in customer && customer.deleted) ? customer.email : '(deleted customer)';
    console.log(
      `${new Date(item.date * 1000).toISOString().slice(0, 10)}  ${email}  €${(item.amount / 100).toFixed(2)}  ${item.description}  [${item.id}]`,
    );

    if (APPLY) {
      await stripe.invoiceItems.del(item.id);
      deleted++;
    }
  }

  console.log(
    `\n${found} pending item(s), €${(totalCents / 100).toFixed(2)} in total` +
      (APPLY ? `, ${deleted} deleted.` : '.'),
  );
  if (!APPLY && found > 0) console.log('Run `npm run cleanup:invoice-items:apply` to delete them.');
}

main().catch((err) => {
  console.error('Invoice item cleanup failed:', err);
  process.exitCode = 1;
});
