import express, { Request, Response } from 'express';
import {
  generatePaymentForm,
  handlePaymentSuccess,
  handlePaymentCancel,
  handlePaymentNotification
} from '../controllers/payfast.controller';

const router = express.Router();

// Generate payment form for a quote
router.get('/pay', (req: Request, res: Response) => generatePaymentForm(req, res));

// Handle payment success return
router.get('/success', (req: Request, res: Response) => handlePaymentSuccess(req, res));

// Handle payment cancellation return
router.get('/cancel', (req: Request, res: Response) => handlePaymentCancel(req, res));

// Handle PayFast ITN (Instant Transaction Notification)
router.post('/notify', (req: Request, res: Response) => handlePaymentNotification(req, res));

export default router;
