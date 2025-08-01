import express from 'express';
import { downloadInvoice, createInvoiceFromPayment } from '../controllers/invoice.controller';

const router = express.Router();

// Download invoice PDF for a quote
router.get('/download/:quoteId', downloadInvoice);

// Create invoice from payment (used by PayFast ITN handler)
router.post('/create-from-payment', createInvoiceFromPayment);

export default router;
