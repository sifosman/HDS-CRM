import express from 'express';
import InvoicePdfController from '../controllers/invoice-pdf.controller';

const router = express.Router();

/**
 * @route   POST /api/invoices/generate/:quoteNumber
 * @desc    Generate invoice PDF for a quote
 * @access  Public
 */
router.post('/generate/:quoteNumber', InvoicePdfController.generateInvoicePdf);

/**
 * @route   GET /api/invoices/:invoiceNumber
 * @desc    Get invoice details including PDF URL
 * @access  Public
 */
router.get('/:invoiceNumber', InvoicePdfController.getInvoiceDetails);

/**
 * @route   POST /api/invoices/regenerate/:invoiceNumber
 * @desc    Regenerate invoice PDF
 * @access  Public
 */
router.post('/regenerate/:invoiceNumber', InvoicePdfController.regenerateInvoicePdf);

export default router;
