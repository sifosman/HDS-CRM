import { Router } from 'express';
import { sendTestPaymentEmail } from '../controllers/test-email.controller';

const router = Router();

// Test endpoint to send payment confirmation email
router.get('/send-payment-email', sendTestPaymentEmail);

export default router;
