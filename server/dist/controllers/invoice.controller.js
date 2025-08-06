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
        console.log('🔍 [DEBUG] Downloading invoice for quote:', quoteId);
        console.log('🔍 [DEBUG] Quote ID type:', typeof quoteId);
        console.log('🔍 [DEBUG] Quote ID length:', quoteId.length);
        console.log('🔍 [DEBUG] Quote ID (URL decoded):', decodeURIComponent(quoteId));
        // First, find the invoice associated with this quote
        const invoiceResult = await supabase_service_1.default.fetchInvoiceByQuoteId(quoteId);
        if (invoiceResult.success && invoiceResult.data) {
            console.log('Found invoice for quote:', quoteId, 'Invoice number:', invoiceResult.data.invoice_number);
            // Try to find and download the invoice PDF from the invoices bucket
            const downloadResult = await supabase_service_1.default.downloadInvoicePdf(invoiceResult.data.invoice_number);
            if (downloadResult.success && downloadResult.data) {
                console.log('Found PDF in storage for invoice:', invoiceResult.data.invoice_number);
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="${downloadResult.fileName}"`);
                res.send(downloadResult.data);
                return;
            }
            else {
                console.log('No invoice PDF found in storage for invoice:', invoiceResult.data.invoice_number);
            }
        }
        else {
            console.log('No invoice found for quote:', quoteId);
        }
        // If no PDF found, try to generate an invoice based on the actual quote data
        console.log('No PDF found, fetching quote data for:', quoteId);
        // First, get the quote details to use the same data structure as the quote PDF
        console.log('🔍 [DEBUG] Attempting to fetch quote with fetchQuoteByNumber:', quoteId);
        const quoteResult = await supabase_service_1.default.fetchQuoteByNumber(quoteId);
        console.log('🔍 [DEBUG] fetchQuoteByNumber result:', {
            success: quoteResult.success,
            hasData: !!quoteResult.data,
            error: quoteResult.error
        });
        if (!quoteResult.success || !quoteResult.data) {
            console.error('❌ [ERROR] Could not fetch quote data for invoice generation:', quoteId);
            console.error('❌ [ERROR] fetchQuoteByNumber response:', quoteResult);
            // Try to get all quotes to see what's available
            console.log('🔍 [DEBUG] Attempting to fetch all quotes to debug...');
            try {
                // Let's try to fetch a few quotes to see what quote numbers exist
                const debugQuoteResult = await supabase_service_1.default.fetchQuoteById('any'); // This will fail but might give us info
                console.log('🔍 [DEBUG] Debug quote fetch result:', debugQuoteResult);
            }
            catch (debugError) {
                console.error('❌ [ERROR] Could not fetch sample quotes:', debugError);
            }
            res.status(404).json({
                success: false,
                message: `Could not find quote data for ID: ${quoteId}. Please check that the quote exists in the database.`
            });
            return;
        }
        console.log(`Successfully fetched quote data for ${quoteId}`);
        // Extract the quote data including sections, items, totals
        const quoteData = quoteResult.data;
        // Use simple defaults for branch and banking data
        const branchData = { name: 'HDS Group', phone: '', address: '', email: '' };
        const bankingDetails = { bank: '', account: '', branch: '' };
        // Try to parse sections and items
        let sections = [];
        let items = [];
        try {
            sections = JSON.parse(quoteData.sections || '[]');
        }
        catch (e) {
            console.error('Failed to parse sections:', e);
            sections = [{
                    name: 'Custom Furniture',
                    items: [{ description: 'Custom Furniture', quantity: 1, unitPrice: quoteData.subtotal || 0, total: quoteData.subtotal || 0 }],
                    subtotal: quoteData.subtotal || 0,
                    sectionTotal: quoteData.subtotal || 0
                }];
        }
        try {
            items = JSON.parse(quoteData.items || '[]');
        }
        catch (e) {
            console.error('Failed to parse items:', e);
            items = [{ description: 'Custom Furniture', quantity: 1, unitPrice: quoteData.subtotal || 0, total: quoteData.subtotal || 0 }];
        }
        // Construct invoice data using the actual quote data
        const invoiceData = {
            quoteId: quoteData.quote_number,
            customerName: quoteData.customer_name || 'Customer',
            customerEmail: quoteData.customer_email || '',
            customerPhone: quoteData.customer_phone || '',
            date: new Date().toISOString(),
            projectName: quoteData.project_name || 'Custom Furniture',
            sections,
            items,
            subtotal: quoteData.subtotal || 0,
            tax: quoteData.tax || 0,
            total: quoteData.total || 0,
            grandTotal: quoteData.total || 0,
            branchData,
            bankingDetails,
            edgingLength: quoteData.edging_length || 0,
            edgingCost: quoteData.edging_cost || 0
        };
        console.log('Generated invoice data from quote:', invoiceData.quoteId);
        // Generate PDF with isPaid=true to mark it as an invoice
        const invoiceResult2 = await (0, optimizer_service_1.generateQuotePdf)(invoiceData, true);
        if (invoiceResult2 && invoiceResult2.buffer) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="${quoteId}.pdf"`);
            res.send(invoiceResult2.buffer);
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
