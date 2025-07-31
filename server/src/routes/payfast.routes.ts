import express from 'express';
import {
  generatePaymentForm,
  handlePaymentSuccess,
  handlePaymentCancel,
  handlePaymentNotification
} from '../controllers/payfast.controller';

const router = express.Router();

// Generate payment form for a quote
router.get('/pay', generatePaymentForm);

// Handle payment success return
router.get('/success', handlePaymentSuccess);

// Handle payment cancellation return
router.get('/cancel', handlePaymentCancel);

// Handle PayFast ITN (Instant Transaction Notification)
router.post('/notify', handlePaymentNotification);

export default router;
