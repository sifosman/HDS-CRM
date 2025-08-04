import express, { Request, Response } from 'express';
import { testEmailConnection, testPaymentEmail } from '../controllers/email-test.controller';

const router = express.Router();

// Test email service connection
router.get('/test-email-connection', (req: Request, res: Response) => testEmailConnection(req, res));

// Test sending a payment confirmation email
router.post('/test-payment-email', (req: Request, res: Response) => testPaymentEmail(req, res));

export default router;
