import express from 'express';
import invoiceController from '../controllers/invoice.controller';

const router = express.Router();

// Download invoice PDF for a quote
router.get('/download/:quoteId', invoiceController.downloadInvoice);

// Create invoice from payment (used by PayFast ITN handler)
router.post('/create-from-payment', invoiceController.createInvoiceFromPayment);

export default router;
