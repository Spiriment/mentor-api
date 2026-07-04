/** Success URL for Stripe checkout / billing portal return. */
export const APP_DEEP_LINK_SUCCESS =
  process.env.APP_DEEP_LINK_SUCCESS ??
  process.env.APP_DEEP_LINK ??
  'spiriment://subscription/success';

/** Cancel URL for Stripe checkout — never reuse the success deep link. */
export const APP_DEEP_LINK_CANCEL =
  process.env.APP_DEEP_LINK_CANCEL ?? 'spiriment://subscription/cancel';
