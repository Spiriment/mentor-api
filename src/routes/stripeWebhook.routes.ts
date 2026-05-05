import { Router } from 'express';
import express from 'express';
import { handleStripeWebhook } from '@/controllers/stripeWebhook.controller';

const router = Router();

// Raw body required for Stripe signature verification — must NOT use express.json() on this route
router.post('/', express.raw({ type: 'application/json' }), handleStripeWebhook);

export default router;
