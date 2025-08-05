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
        // Import Supabase client for storage operations
        const { createClient } = require('@supabase/supabase-js');
        const supabaseUrl = process.env.SUPABASE_URL || '';
        const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
        const supabase = createClient(supabaseUrl, supabaseKey);
        // First, find the invoice associated with this quote
        try {
            const { data: invoiceData, error: invoiceError } = await supabase
                .from('invoices')
                .select('invoice_number')
                .eq('quote_number', quoteId)
                .single();
            if (invoiceData && !invoiceError) {
                console.log('Found invoice for quote:', quoteId, 'Invoice number:', invoiceData.invoice_number);
                // Try to find the invoice PDF in the invoices bucket
                // Invoice PDFs are saved with format: invoice-{invoiceNumber}-{timestamp}.pdf
                // We'll need to list files and find the one that matches our invoice number
                const { data: files, error: listError } = await supabase
                    .storage
                    .from('invoices')
                    .list('', {
                    search: `invoice-${invoiceData.invoice_number}-`
                });
                if (files && files.length > 0 && !listError) {
                    // Sort by name to get the most recent one (assuming timestamp is in the filename)
                    files.sort((a, b) => b.name.localeCompare(a.name));
                    const latestFile = files[0];
                    console.log('Found invoice PDF:', latestFile.name);
                    // Download the PDF
                    const { data: pdfData, error: pdfError } = await supabase
                        .storage
                        .from('invoices')
                        .download(latestFile.name);
                    if (pdfData && !pdfError) {
                        console.log('Found PDF in storage:', latestFile.name);
                        res.setHeader('Content-Type', 'application/pdf');
                        res.setHeader('Content-Disposition', `attachment; filename="${latestFile.name}"`);
                        res.send(Buffer.from(await pdfData.arrayBuffer()));
                        return;
                    }
                    else {
                        console.error('Error downloading PDF:', pdfError);
                    }
                }
                else {
                    console.log('No invoice PDF found in storage for invoice:', invoiceData.invoice_number);
                }
            }
            else {
                console.log('No invoice found for quote:', quoteId);
            }
        }
        catch (invoiceLookupError) {
            console.error('Error looking up invoice:', invoiceLookupError);
        }
        // If no PDF found, try to generate a simple invoice
        console.log('No PDF found, generating simple invoice for:', quoteId);
        // Generate a basic invoice with placeholder data
        const basicInvoiceData = {
            quoteId,
            customerName: 'Customer',
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
        const result = await supabase_service_1.default.createInvoice(quoteId, paymentDetails);
        if (result.success) {
            res.json({
                success: true,
                data: result.data
            });
        }
        else {
            res.status(500).json({
                success: false,
                message: result.error
            });
        }
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
