"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInvoice = createInvoice;
exports.updateInvoiceStatus = updateInvoiceStatus;
exports.generateAndUploadInvoicePdf = generateAndUploadInvoicePdf;
exports.createInvoiceWithPdf = createInvoiceWithPdf;
const config_1 = require("./config");
const quotes_service_1 = require("./quotes.service");
const storage_service_1 = require("./storage.service");
/**
 * Create a new invoice from a quote
 */
async function createInvoice(quoteNumber, paymentDetails) {
    try {
        // Generate invoice number
        const timestamp = Date.now();
        const invoiceNumber = `INV-${quoteNumber.replace('Q-', '')}-${timestamp}`;
        const { data, error } = await config_1.supabase
            .from('invoices')
            .insert([{
                invoice_number: invoiceNumber,
                quote_number: quoteNumber,
                amount: paymentDetails.amount,
                payment_method: paymentDetails.payment_method || 'payfast',
                payment_status: paymentDetails.payment_status || 'pending',
                payment_reference: paymentDetails.payment_reference,
                created_at: new Date().toISOString(),
                customer_name: paymentDetails.customer_name,
                customer_email: paymentDetails.customer_email,
                project_name: paymentDetails.project_name
            }])
            .select()
            .single();
        if (error) {
            console.error('Error creating invoice:', error);
            return { success: false, error: error.message };
        }
        return {
            success: true,
            data: Object.assign(Object.assign({}, data), { invoiceNumber: invoiceNumber })
        };
    }
    catch (error) {
        console.error('Error in createInvoice:', error);
        return { success: false, error: error.message };
    }
}
/**
 * Update invoice status
 */
async function updateInvoiceStatus(invoiceNumber, status) {
    try {
        const { data, error } = await config_1.supabase
            .from('invoices')
            .update({ payment_status: status })
            .eq('invoice_number', invoiceNumber)
            .select()
            .single();
        if (error) {
            console.error('Error updating invoice status:', error);
            return { success: false, error: error.message };
        }
        return { success: true, data };
    }
    catch (error) {
        console.error('Error in updateInvoiceStatus:', error);
        return { success: false, error: error.message };
    }
}
/**
 * Generate invoice PDF from quote data and upload to invoices bucket
 * @param quoteNumber The quote number to generate invoice for
 * @param invoiceNumber The invoice number for the PDF filename
 * @returns Promise with the public URL of the generated PDF
 */
async function generateAndUploadInvoicePdf(quoteNumber, invoiceNumber) {
    try {
        // Fetch the quote data
        const quoteResult = await (0, quotes_service_1.fetchQuoteByNumber)(quoteNumber);
        if (!quoteResult.success) {
            return { success: false, error: `Failed to fetch quote: ${quoteResult.error}` };
        }
        const quoteData = quoteResult.data;
        // Dynamically import the PDF generation function
        const { generateInvoicePdf } = require('../optimizer.service');
        // Generate the invoice PDF
        const pdfBuffer = await generateInvoicePdf(Object.assign(Object.assign({}, quoteData), { invoiceNumber: invoiceNumber, invoiceDate: new Date().toISOString().split('T')[0] }));
        if (!pdfBuffer) {
            return { success: false, error: 'Failed to generate PDF buffer' };
        }
        // Upload to invoices bucket
        const fileName = `${invoiceNumber}.pdf`;
        const uploadResult = await (0, storage_service_1.uploadInvoicePdf)(pdfBuffer, fileName);
        return uploadResult;
    }
    catch (error) {
        console.error('Error in generateAndUploadInvoicePdf:', error);
        return { success: false, error: error.message };
    }
}
/**
 * Create invoice with PDF generation and upload
 * @param quoteNumber The quote number to create invoice for
 * @param paymentDetails Payment details for the invoice
 * @returns Promise with invoice data and PDF URL
 */
async function createInvoiceWithPdf(quoteNumber, paymentDetails) {
    try {
        // First create the invoice record
        const invoiceResult = await createInvoice(quoteNumber, paymentDetails);
        if (!invoiceResult.success) {
            return { success: false, error: invoiceResult.error };
        }
        const invoiceNumber = invoiceResult.data.invoiceNumber;
        // Generate and upload the PDF
        const pdfResult = await generateAndUploadInvoicePdf(quoteNumber, invoiceNumber);
        if (!pdfResult.success) {
            return { success: false, error: pdfResult.error };
        }
        // Update the invoice with the PDF URL
        const { error: updateError } = await config_1.supabase
            .from('invoices')
            .update({ pdf_url: pdfResult.publicUrl })
            .eq('invoice_number', invoiceNumber);
        if (updateError) {
            console.error('Error updating invoice PDF URL:', updateError);
        }
        return {
            success: true,
            data: Object.assign(Object.assign({}, invoiceResult.data), { pdfUrl: pdfResult.publicUrl })
        };
    }
    catch (error) {
        console.error('Error in createInvoiceWithPdf:', error);
        return { success: false, error: error.message };
    }
}
