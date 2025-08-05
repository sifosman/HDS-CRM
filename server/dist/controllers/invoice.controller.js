"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInvoiceFromPayment = exports.downloadInvoice = void 0;
const optimizer_service_1 = require("../services/optimizer.service");
const supabase_service_1 = __importDefault(require("../services/supabase.service"));
/**
 * Download invoice PDF directly from storage
 * This bypasses the database requirement since quotes are saved as PDFs in storage
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
        console.log('Downloading invoice for quote:', quoteId);
        // The PDFs are saved with just the quote ID as filename
        const pdfFilename = `${quoteId}`;
        // Try to get the quote PDF from storage first
        try {
            // Import Supabase client for storage operations
            const { createClient } = require('@supabase/supabase-js');
            const supabaseUrl = process.env.SUPABASE_URL || '';
            const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
            const supabase = createClient(supabaseUrl, supabaseKey);
            // Check if PDF exists in storage
            const { data: pdfData, error: pdfError } = await supabase
                .storage
                .from('hds_quotes')
                .download(pdfFilename);
            if (pdfData && !pdfError) {
                console.log('Found PDF in storage:', pdfFilename);
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="${quoteId}.pdf"`);
                res.send(Buffer.from(await pdfData.arrayBuffer()));
                return;
            }
            // If no PDF found, try to generate a simple invoice
            console.log('No PDF found, generating simple invoice for:', quoteId);
            // Create basic invoice data
            const basicInvoiceData = {
                quoteId: quoteId,
                customerName: 'Customer',
                projectName: 'Project',
                date: new Date().toISOString(),
                items: [
                    { description: 'Custom Furniture Quote', quantity: 1, unitPrice: 1000, total: 1000 }
                ],
                subtotal: 1000,
                tax: 150,
                total: 1150
            };
            const invoiceResult = await (0, optimizer_service_1.generateQuotePdf)(basicInvoiceData, true);
            if (invoiceResult && invoiceResult.buffer) {
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="${quoteId}.pdf"`);
                res.send(invoiceResult.buffer);
                return;
            }
            res.status(404).json({
                success: false,
                message: 'Quote PDF not found and could not generate invoice'
            });
        }
        catch (storageError) {
            console.error('Storage error:', storageError);
            res.status(500).json({
                success: false,
                message: 'Error accessing storage'
            });
        }
    }
    catch (error) {
        console.error('Error downloading invoice:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
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
