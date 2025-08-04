"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInvoiceFromPayment = exports.downloadInvoice = void 0;
const optimizer_service_1 = require("../services/optimizer.service");
const supabase_service_1 = __importDefault(require("../services/supabase.service"));
/**
 * Generate and download invoice PDF for a quote
 */
const downloadInvoice = async (req, res) => {
    try {
        const { quoteId } = req.params;
        if (!quoteId) {
            res.status(400).json({
                success: false,
                message: 'Quote ID is required'
            });
            return;
        }
        console.log('Generating invoice for quote:', quoteId);
        // Get quote data from Supabase
        const quoteResult = await supabase_service_1.default.fetchQuoteById(quoteId);
        if (!quoteResult.success || !quoteResult.data) {
            res.status(404).json({
                success: false,
                message: 'Quote not found'
            });
            return;
        }
        const quoteData = quoteResult.data;
        // Generate invoice PDF
        const invoiceResult = await (0, optimizer_service_1.generateInvoicePdf)(quoteData);
        if (!invoiceResult || !invoiceResult.buffer) {
            res.status(500).json({
                success: false,
                message: 'Failed to generate invoice PDF'
            });
            return;
        }
        // Set response headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="invoice-${quoteId}.pdf"`);
        res.setHeader('Content-Length', invoiceResult.buffer.length);
        // Send the PDF buffer
        res.send(invoiceResult.buffer);
    }
    catch (error) {
        console.error('Error generating invoice:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while generating invoice'
        });
    }
};
exports.downloadInvoice = downloadInvoice;
/**
 * Create an invoice from a quote after successful payment
 */
const createInvoiceFromPayment = async (req, res) => {
    try {
        const { quoteId, paymentDetails } = req.body;
        if (!quoteId || !paymentDetails) {
            res.status(400).json({
                success: false,
                message: 'Quote ID and payment details are required'
            });
            return;
        }
        // Create invoice record in database
        const invoiceResult = await supabase_service_1.default.createInvoice(quoteId, paymentDetails);
        if (!invoiceResult.success) {
            res.status(500).json({
                success: false,
                message: 'Failed to create invoice record'
            });
            return;
        }
        // Update quote status to 'approved'
        await supabase_service_1.default.updateQuoteStatus(quoteId, 'approved');
        res.status(200).json({
            success: true,
            message: 'Invoice created successfully',
            data: invoiceResult.data
        });
    }
    catch (error) {
        console.error('Error creating invoice from payment:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while creating invoice'
        });
    }
};
exports.createInvoiceFromPayment = createInvoiceFromPayment;
