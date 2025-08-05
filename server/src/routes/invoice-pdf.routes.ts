import express from 'express';
import { InvoicePdfController } from '../controllers/invoice-pdf.controller';

const router = express.Router();
const invoicePdfController = new InvoicePdfController();

// POST /api/invoices/generate-pdf - Generate invoice PDF from quote data
router.post('/generate-pdf', (req, res) => invoicePdfController.generateInvoicePdf(req, res));

// GET /api/invoices/:invoiceNumber - Get invoice details including PDF URL
router.get('/:invoiceNumber', (req, res) => invoicePdfController.getInvoice(req, res));

// POST /api/invoices/regenerate-pdf/:invoiceNumber - Regenerate invoice PDF
router.post('/regenerate-pdf/:invoiceNumber', (req, res) => invoicePdfController.regenerateInvoicePdf(req, res));

export default router;
