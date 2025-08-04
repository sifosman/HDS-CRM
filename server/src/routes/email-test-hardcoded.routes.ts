import express, { Request, Response } from 'express';
import { testPaymentEmailHardcoded, quickTestEmail } from '../controllers/email-test-hardcoded.controller';

const router = express.Router();

// Test endpoint with hardcoded email for sifosman@gmail.com
router.post('/test-payment-email-hardcoded', (req: Request, res: Response) => testPaymentEmailHardcoded(req, res));

// Quick test endpoint - just send a test email
router.get('/quick-test', (req: Request, res: Response) => quickTestEmail(req, res));

export default router;
