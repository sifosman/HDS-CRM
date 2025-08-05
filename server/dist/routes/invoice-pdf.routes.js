"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const invoice_pdf_controller_1 = require("../controllers/invoice-pdf.controller");
const router = express_1.default.Router();
const invoicePdfController = new invoice_pdf_controller_1.InvoicePdfController();
// POST /api/invoices/generate-pdf - Generate invoice PDF from quote data
router.post('/generate-pdf', (req, res) => invoicePdfController.generateInvoicePdf(req, res));
// GET /api/invoices/:invoiceNumber - Get invoice details including PDF URL
router.get('/:invoiceNumber', (req, res) => invoicePdfController.getInvoice(req, res));
// POST /api/invoices/regenerate-pdf/:invoiceNumber - Regenerate invoice PDF
router.post('/regenerate-pdf/:invoiceNumber', (req, res) => invoicePdfController.regenerateInvoicePdf(req, res));
exports.default = router;
