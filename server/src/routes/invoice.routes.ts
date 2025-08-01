import express from 'express';
import invoiceController from '../controllers/invoice.controller';

const router = express.Router();

// Download invoice PDF for a quote
router.get('/download/:quoteId', (req, res) => invoiceController.downloadInvoice(req, res));

// Create invoice from payment (used by PayFast ITN handler)
router.post('/create-from-payment', (req, res) => invoiceController.createInvoiceFromPayment(req, res));

export default router;
