"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const invoice_pdf_controller_1 = __importDefault(require("../controllers/invoice-pdf.controller"));
const router = express_1.default.Router();
/**
 * @route   POST /api/invoices/generate/:quoteNumber
 * @desc    Generate invoice PDF for a quote
 * @access  Public
 */
router.post('/generate/:quoteNumber', invoice_pdf_controller_1.default.generateInvoicePdf);
/**
 * @route   GET /api/invoices/:invoiceNumber
 * @desc    Get invoice details including PDF URL
 * @access  Public
 */
router.get('/:invoiceNumber', invoice_pdf_controller_1.default.getInvoiceDetails);
/**
 * @route   POST /api/invoices/regenerate/:invoiceNumber
 * @desc    Regenerate invoice PDF
 * @access  Public
 */
router.post('/regenerate/:invoiceNumber', invoice_pdf_controller_1.default.regenerateInvoicePdf);
exports.default = router;
